import { randomUUID } from 'node:crypto';
import type {
  AnswerResult,
  CountdownView,
  GamePhase,
  GameSnapshot,
  InSeries,
  PlayerPublic,
  QuestionView,
  RevealView,
  ScoreEntry,
  SeriesEndView,
  SeriesInfo,
} from '@quiz/shared';
import { QUESTION_COUNTDOWN_SEC, randomAvatar, type Avatar, type QuestionType, type Reaction } from '@quiz/shared';
import { prisma } from '../lib/prisma';
import type { TypedServer, TypedSocket } from '../socket/types';
import { computePoints, rankPlayers, type ScoringRules } from './scoring';

export interface GameQuiz {
  id: string;
  title: string;
  scoring: ScoringRules;
  /** Solo las series con preguntas, en orden. */
  series: { title: string }[];
  /** Todas las preguntas en orden; `seriesIndex` apunta a `series`. */
  questions: {
    seriesIndex: number;
    type: QuestionType;
    text: string;
    imageId: string | null;
    options: string[];
    correctIndices: number[];
    timeLimitSec: number;
    explanation: string | null;
  }[];
}

interface AnswerRecord {
  choices: number[]; // vacío = no respondió
  correct: boolean;
  points: number; // fijos + bono por rapidez
  streak: number;
  responseMs: number | null;
}

interface Player {
  id: string;
  token: string;
  nickname: string;
  avatar: Avatar;
  score: number;
  socketId: string | null;
  lastReactionAt: number;
  streak: number; // aciertos seguidos (solo para mostrar)
  totalMs: number; // tiempo total respondiendo: desempata (sin responder cuenta el tiempo completo)
  answers: (AnswerRecord | undefined)[]; // indexado por número de pregunta
}

/** Error esperado (regla del juego); el mensaje se envía tal cual al cliente. */
export class GameError extends Error {}

const MAX_PLAYERS = 200;
// Generoso: el moderador puede dirigir desde el celular y bloquearlo un rato sin cerrar la partida.
const HOST_GRACE_MS = 30 * 60_000;
const FINISHED_TTL_MS = 10 * 60_000;
// Con 200 jugadores entrando o respondiendo a la vez, el anfitrión recibe como mucho
// una actualización de la lista y del contador cada este intervalo (no una por jugador).
const HOST_UPDATE_MS = 150;
// Una reacción por jugador cada este tiempo: suficiente para animar, sin dejar que nadie inunde la pantalla.
const REACTION_COOLDOWN_MS = 1500;
const NICKNAME_MAX = 20;

export class Game {
  readonly hostToken = randomUUID();
  phase: GamePhase = 'lobby';

  private players = new Map<string, Player>();
  private hostSocketId: string | null = null;
  private index = -1;
  private questionStartedAt = 0;
  private endsAt = 0;
  private countdownEndsAt = 0;
  private phaseTimer?: NodeJS.Timeout; // cuenta regresiva o tiempo de la pregunta (nunca ambos)
  private lifecycleTimer?: NodeJS.Timeout;
  private hostUpdateTimer?: NodeJS.Timeout;
  private previousRanks = new Map<string, number>(); // para las flechas de la clasificación
  private seriesTop: ScoreEntry[] = []; // la tabla mostrada al terminar la serie (para quien se reconecte)
  private pendingHostUpdates = new Set<'players' | 'progress' | 'reactions'>();
  private pendingReactions = new Map<Reaction, number>();
  private startedAt: Date | null = null;
  private closed = false;

  constructor(
    readonly pin: string,
    private readonly quiz: GameQuiz,
    private readonly io: TypedServer,
    private readonly onClose: (game: Game) => void,
  ) {
    this.armLifecycleTimer(HOST_GRACE_MS, 'El anfitrión no se conectó');
  }

  get quizTitle() {
    return this.quiz.title;
  }

  private get room() {
    return `game:${this.pin}`;
  }

  private get hostRoom() {
    return `game:${this.pin}:host`;
  }

  private get currentQuestion() {
    return this.quiz.questions[this.index];
  }

  private get isLastQuestion() {
    return this.index >= this.quiz.questions.length - 1;
  }

  /** La pregunta `index` es la última de su serie (lo siguiente es la tabla). */
  private endsSeries(index: number) {
    const q = this.quiz.questions[index];
    const next = this.quiz.questions[index + 1];
    return !!q && (!next || next.seriesIndex !== q.seriesIndex);
  }

  private seriesInfo(index: number): SeriesInfo {
    const seriesIndex = this.quiz.questions[index]?.seriesIndex ?? 0;
    return { index: seriesIndex, total: this.quiz.series.length, title: this.quiz.series[seriesIndex]?.title ?? '' };
  }

  private inSeries(index: number): InSeries {
    const seriesIndex = this.quiz.questions[index]?.seriesIndex;
    const inThisSeries = this.quiz.questions.flatMap((q, i) => (q.seriesIndex === seriesIndex ? [i] : []));
    return { index: inThisSeries.indexOf(index), total: inThisSeries.length };
  }

  private seriesEndView(): SeriesEndView {
    return { series: this.seriesInfo(this.index), isLast: this.isLastQuestion };
  }

  // ---------- Anfitrión ----------

  isHost(socketId: string) {
    return this.hostSocketId === socketId;
  }

  attachHost(socket: TypedSocket, token: string): GameSnapshot {
    if (token !== this.hostToken) throw new GameError('No autorizado para dirigir esta partida');
    if (this.hostSocketId && this.hostSocketId !== socket.id) {
      this.evictSocket(this.hostSocketId, 'Abriste la partida en otra pestaña');
    }
    this.hostSocketId = socket.id;
    socket.data = { pin: this.pin, role: 'host' };
    socket.join([this.room, this.hostRoom]);
    if (this.phase !== 'podium') this.clearLifecycleTimer();
    return this.snapshot(null);
  }

  /** Pantalla TV: recibe lo mismo que el anfitrión pero no puede controlar nada. Puede haber varias. */
  attachScreen(socket: TypedSocket): GameSnapshot {
    socket.data = { pin: this.pin, role: 'screen' };
    socket.join([this.room, this.hostRoom]);
    return this.snapshot(null);
  }

  detachHost(socketId: string) {
    if (this.hostSocketId !== socketId) return;
    this.hostSocketId = null;
    if (this.phase !== 'podium') this.armLifecycleTimer(HOST_GRACE_MS, 'El anfitrión se desconectó');
  }

  start() {
    if (this.phase !== 'lobby') throw new GameError('La partida ya comenzó');
    if (this.connectedPlayers().length === 0) throw new GameError('Espera a que se una al menos un jugador');
    this.startedAt = new Date();
    this.startCountdown();
  }

  /**
   * Avanza a la siguiente fase. En 'countdown' muestra la pregunta ya;
   * en 'question' la cierra antes de tiempo.
   */
  next() {
    switch (this.phase) {
      case 'lobby':
        return this.start();
      case 'countdown':
        return this.startQuestion(this.index + 1);
      case 'question':
        return this.endQuestion();
      // Al terminar una serie se muestra su tabla; si no, se sigue con la siguiente pregunta.
      case 'reveal':
        return this.endsSeries(this.index) ? this.showLeaderboard() : this.startCountdown();
      // Después de la tabla: la siguiente serie o, si era la última, el ganador.
      case 'leaderboard':
        return this.isLastQuestion ? this.finish() : this.startCountdown();
      case 'podium':
        throw new GameError('La partida ya terminó');
    }
  }

  /** Termina la partida: si ya se jugó algo, va al podio y guarda resultados. */
  end() {
    const nothingPlayed = this.phase === 'countdown' && this.index < 0;
    if (this.phase === 'lobby' || this.phase === 'podium' || nothingPlayed) {
      this.close('El anfitrión cerró la partida');
      return;
    }
    clearTimeout(this.phaseTimer); // por si estaba en cuenta regresiva
    if (this.phase === 'question') this.endQuestion();
    this.finish();
  }

  /** Reinicia la partida conservando a los jugadores conectados (botón «Jugar otra vez»). */
  playAgain() {
    if (this.phase !== 'podium') throw new GameError('La partida todavía no terminó');
    clearTimeout(this.phaseTimer);
    this.phase = 'lobby';
    this.index = -1;
    this.startedAt = null;
    this.previousRanks.clear();
    for (const p of this.players.values()) {
      p.score = 0;
      p.streak = 0;
      p.totalMs = 0;
      p.answers = [];
    }
    this.armLifecycleTimer(HOST_GRACE_MS, 'La partida se quedó sin anfitrión');
    for (const p of this.players.values()) {
      if (p.socketId) this.io.to(p.socketId).emit('game:state', this.snapshot(p));
    }
    if (this.hostSocketId) this.io.to(this.hostSocketId).emit('game:state', this.snapshot(null));
  }

  kick(playerId: string) {
    const player = this.players.get(playerId);
    if (!player) throw new GameError('Ese jugador ya no está en la partida');
    this.players.delete(playerId);
    if (player.socketId) this.evictSocket(player.socketId, 'El anfitrión te sacó de la partida');
    this.broadcastPlayers();
    this.emitProgress();
    this.maybeEndQuestionEarly();
  }

  // ---------- Jugadores ----------

  hasPlayerSocket(playerId: string, socketId: string) {
    return this.players.get(playerId)?.socketId === socketId;
  }

  addPlayer(socket: TypedSocket, nickname: string, avatar: Avatar = randomAvatar()) {
    if (this.phase === 'podium') throw new GameError('La partida ya terminó');
    if (this.players.size >= MAX_PLAYERS) throw new GameError('La partida está llena');
    const player: Player = {
      id: randomUUID(),
      token: randomUUID(),
      nickname: this.uniqueNickname(nickname),
      avatar,
      score: 0,
      socketId: null,
      lastReactionAt: 0,
      streak: 0,
      totalMs: 0,
      answers: [],
    };
    this.players.set(player.id, player);
    this.bindPlayerSocket(player, socket);
    this.broadcastPlayers();
    this.emitProgress();
    return { playerId: player.id, playerToken: player.token, state: this.snapshot(player) };
  }

  rejoinPlayer(socket: TypedSocket, token: string): GameSnapshot {
    const player = [...this.players.values()].find((p) => p.token === token);
    if (!player) throw new GameError('Tu sesión en esta partida ya no es válida');
    this.bindPlayerSocket(player, socket);
    this.broadcastPlayers();
    return this.snapshot(player);
  }

  detachPlayer(playerId: string, socketId: string) {
    const player = this.players.get(playerId);
    if (!player || player.socketId !== socketId) return;
    // Se conserva el jugador (y su puntaje) para que pueda reconectarse.
    player.socketId = null;
    this.broadcastPlayers();
  }

  /**
   * Reacción para la pantalla grande. Solo entre preguntas (lobby, clasificación, podio): durante
   * la pregunta y la revelación taparían lo importante. Las demasiado seguidas se ignoran sin avisar.
   */
  react(playerId: string, emoji: Reaction) {
    if (!['lobby', 'leaderboard', 'podium'].includes(this.phase)) return;
    const player = this.players.get(playerId);
    const now = Date.now();
    if (!player || now - player.lastReactionAt < REACTION_COOLDOWN_MS) return;
    player.lastReactionAt = now;
    this.pendingReactions.set(emoji, (this.pendingReactions.get(emoji) ?? 0) + 1);
    this.queueHostUpdate('reactions');
  }

  answer(playerId: string, questionIndex: number, choices: number[]) {
    const now = Date.now();
    if (this.phase !== 'question' || questionIndex !== this.index || now > this.endsAt) {
      throw new GameError('Se acabó el tiempo para esta pregunta');
    }
    const player = this.players.get(playerId);
    if (!player) throw new GameError('No estás en esta partida');
    if (player.answers[this.index]) throw new GameError('Ya respondiste esta pregunta');

    const q = this.currentQuestion!;
    if (choices.some((c) => c >= q.options.length)) throw new GameError('Esa opción no existe');
    if (q.type !== 'multiple' && choices.length !== 1) throw new GameError('Elige una sola opción');
    const responseMs = now - this.questionStartedAt;
    // Selección múltiple: solo cuenta si marcó exactamente las correctas.
    const correct =
      choices.length === q.correctIndices.length && choices.every((c) => q.correctIndices.includes(c));
    // Los puntos se suman al puntaje recién en endQuestion: así el puntaje no delata si acertó.
    player.answers[this.index] = {
      choices: [...choices].sort((a, b) => a - b),
      correct,
      points: computePoints(correct, responseMs, q.timeLimitSec * 1000, this.quiz.scoring),
      streak: 0,
      responseMs,
    };
    this.emitProgress();
    this.maybeEndQuestionEarly();
  }

  // ---------- Transiciones ----------

  /** "¡Prepárate!" antes de la siguiente pregunta; el servidor decide cuándo termina. */
  private startCountdown() {
    const next = this.index + 1;
    if (!this.quiz.questions[next]) throw new GameError('No hay más preguntas');
    this.phase = 'countdown';
    this.countdownEndsAt = Date.now() + QUESTION_COUNTDOWN_SEC * 1000;
    this.phaseTimer = setTimeout(() => this.startQuestion(next), QUESTION_COUNTDOWN_SEC * 1000);
    this.io.to(this.room).emit('question:countdown', this.countdownView());
  }

  private startQuestion(index: number) {
    const q = this.quiz.questions[index];
    if (!q) throw new GameError('No hay más preguntas');
    clearTimeout(this.phaseTimer);
    this.index = index;
    this.phase = 'question';
    this.questionStartedAt = Date.now();
    this.endsAt = this.questionStartedAt + q.timeLimitSec * 1000;
    this.phaseTimer = setTimeout(() => this.endQuestion(), q.timeLimitSec * 1000);
    this.io.to(this.room).emit('question:start', this.questionView()!);
    this.emitProgress();
  }

  private endQuestion() {
    if (this.phase !== 'question') return;
    clearTimeout(this.phaseTimer);
    this.phase = 'reveal';
    const limitMs = this.currentQuestion!.timeLimitSec * 1000;
    for (const p of this.players.values()) {
      const a = (p.answers[this.index] ??= {
        choices: [],
        correct: false,
        points: 0,
        streak: 0,
        responseMs: null,
      });
      p.streak = a.correct ? p.streak + 1 : 0;
      a.streak = p.streak;
      p.score += a.points;
      p.totalMs += a.responseMs ?? limitMs;
    }
    this.io.to(this.room).emit('question:reveal', this.revealView()!);
    const ranks = this.ranks();
    for (const p of this.players.values()) {
      if (p.socketId) this.io.to(p.socketId).emit('player:result', this.resultFor(p, ranks));
    }
  }

  /** Tabla de fin de serie. Las flechas comparan con la tabla de la serie anterior. */
  private showLeaderboard() {
    this.phase = 'leaderboard';
    this.seriesTop = this.top(5);
    this.io.to(this.room).emit('game:leaderboard', { top: this.seriesTop, seriesEnd: this.seriesEndView() });
    this.previousRanks = this.ranks();
  }

  private finish() {
    this.phase = 'podium';
    const ranks = this.ranks();
    const top = this.top(3, ranks);
    this.io.to(this.hostRoom).emit('game:podium', { top, me: null }); // anfitrión y pantallas TV
    for (const p of this.players.values()) {
      if (p.socketId) {
        this.io.to(p.socketId).emit('game:podium', { top, me: { score: p.score, rank: ranks.get(p.id) ?? 0 } });
      }
    }
    // Se mantiene en memoria un rato para que quien recargue vea el podio.
    this.armLifecycleTimer(FINISHED_TTL_MS, 'La partida terminó');
    this.persist().catch((err) => console.error(`No se pudo guardar la partida ${this.pin}:`, err));
  }

  close(reason: string) {
    if (this.closed) return;
    this.closed = true;
    clearTimeout(this.phaseTimer);
    this.clearLifecycleTimer();
    clearTimeout(this.hostUpdateTimer);
    this.io.to(this.room).emit('game:closed', { reason });
    this.io.in(this.room).socketsLeave([this.room, this.hostRoom]);
    this.onClose(this);
  }

  // ---------- Vistas ----------

  snapshot(player: Player | null): GameSnapshot {
    const ranks = this.ranks();
    const inQuestion = this.phase === 'question' || this.phase === 'reveal';
    return {
      pin: this.pin,
      quizTitle: this.quiz.title,
      totalQuestions: this.quiz.questions.length,
      seriesCount: this.quiz.series.length,
      phase: this.phase,
      players: player ? [] : this.publicPlayers(), // los celulares no muestran la lista
      countdown: this.phase === 'countdown' ? this.countdownView() : null,
      question: inQuestion ? this.questionView() : null,
      answeredCount: this.answeredCount(),
      reveal: this.phase === 'reveal' ? this.revealView() : null,
      leaderboard: this.phase === 'leaderboard' ? this.seriesTop : null,
      seriesEnd: this.phase === 'leaderboard' ? this.seriesEndView() : null,
      podium: this.phase === 'podium' ? this.top(3, ranks) : null,
      me: player
        ? {
            id: player.id,
            nickname: player.nickname,
            avatar: player.avatar,
            score: player.score,
            rank: ranks.get(player.id) ?? 0,
            answer: inQuestion ? this.choicesOf(player) : null,
            lastResult: this.phase === 'reveal' ? this.resultFor(player, ranks) : null,
          }
        : null,
    };
  }

  private countdownView(): CountdownView {
    const next = this.index + 1;
    return {
      index: next,
      total: this.quiz.questions.length,
      type: this.quiz.questions[next]!.type,
      series: this.seriesInfo(next),
      inSeries: this.inSeries(next),
      endsAt: this.countdownEndsAt,
      serverNow: Date.now(),
    };
  }

  private questionView(): QuestionView | null {
    const q = this.currentQuestion;
    if (!q) return null;
    return {
      index: this.index,
      total: this.quiz.questions.length,
      type: q.type,
      series: this.seriesInfo(this.index),
      inSeries: this.inSeries(this.index),
      text: q.text,
      imageId: q.imageId,
      options: q.options,
      timeLimitSec: q.timeLimitSec,
      endsAt: this.endsAt,
      serverNow: Date.now(),
    };
  }

  private revealView(): RevealView | null {
    const q = this.currentQuestion;
    if (!q) return null;
    const distribution = Array<number>(q.options.length).fill(0);
    for (const p of this.players.values()) {
      for (const c of p.answers[this.index]?.choices ?? []) distribution[c]!++;
    }
    return {
      index: this.index,
      correctIndices: q.correctIndices,
      distribution,
      explanation: q.explanation,
      endsSeries: this.endsSeries(this.index),
    };
  }

  private resultFor(p: Player, ranks: Map<string, number>): AnswerResult {
    const a = p.answers[this.index];
    return {
      answered: (a?.choices.length ?? 0) > 0,
      correct: a?.correct ?? false,
      points: a?.points ?? 0,
      streak: a?.streak ?? 0,
      totalScore: p.score,
      rank: ranks.get(p.id) ?? 0,
    };
  }

  private ranks() {
    return new Map(rankPlayers([...this.players.values()]).map(({ player, rank }) => [player.id, rank]));
  }

  private top(n: number, ranks = this.ranks()): ScoreEntry[] {
    return rankPlayers([...this.players.values()])
      .slice(0, n)
      .map(({ player }) => {
        const rank = ranks.get(player.id) ?? 0;
        const before = this.previousRanks.get(player.id);
        return {
          playerId: player.id,
          nickname: player.nickname,
          avatar: player.avatar,
          score: player.score,
          rank,
          streak: player.streak,
          delta: before === undefined ? 0 : before - rank,
        };
      });
  }

  private publicPlayers(): PlayerPublic[] {
    return [...this.players.values()].map((p) => ({
      id: p.id,
      nickname: p.nickname,
      avatar: p.avatar,
      connected: p.socketId !== null,
    }));
  }

  /** Si el apodo ya existe se le añade un número ("Ana" → "Ana 2"): entrar no debe fallar por eso. */
  private uniqueNickname(nickname: string) {
    const taken = new Set([...this.players.values()].map((p) => p.nickname.toLocaleLowerCase()));
    if (!taken.has(nickname.toLocaleLowerCase())) return nickname;
    for (let n = 2; ; n++) {
      const suffix = ` ${n}`;
      const candidate = nickname.slice(0, NICKNAME_MAX - suffix.length).trimEnd() + suffix;
      if (!taken.has(candidate.toLocaleLowerCase())) return candidate;
    }
  }

  private connectedPlayers() {
    return [...this.players.values()].filter((p) => p.socketId !== null);
  }

  private answeredCount() {
    if (this.index < 0) return 0;
    return [...this.players.values()].filter((p) => this.choicesOf(p) !== null).length;
  }

  private choicesOf(p: Player): number[] | null {
    const choices = p.answers[this.index]?.choices;
    return choices?.length ? choices : null;
  }

  // ---------- Utilidades ----------

  /** La lista de jugadores solo la ve el anfitrión (enviarla a todos costaba 200×200 mensajes). */
  private broadcastPlayers() {
    this.queueHostUpdate('players');
  }

  private emitProgress() {
    if (this.phase === 'question') this.queueHostUpdate('progress');
  }

  private queueHostUpdate(kind: 'players' | 'progress' | 'reactions') {
    this.pendingHostUpdates.add(kind);
    this.hostUpdateTimer ??= setTimeout(() => this.flushHostUpdates(), HOST_UPDATE_MS);
  }

  private flushHostUpdates() {
    this.hostUpdateTimer = undefined;
    if (this.closed) return;
    if (this.pendingHostUpdates.has('players')) {
      this.io.to(this.hostRoom).emit('lobby:players', { players: this.publicPlayers() });
    }
    if (this.pendingHostUpdates.has('progress') && this.phase === 'question') {
      this.io.to(this.hostRoom).emit('question:progress', { answered: this.answeredCount(), total: this.players.size });
    }
    if (this.pendingHostUpdates.has('reactions') && this.pendingReactions.size > 0) {
      this.io.to(this.hostRoom).emit('host:reactions', { counts: Object.fromEntries(this.pendingReactions) });
      this.pendingReactions.clear();
    }
    this.pendingHostUpdates.clear();
  }

  /**
   * Cierra la pregunta cuando respondieron todos, incluidos los desconectados: en el celular
   * basta bloquear la pantalla para perder el socket, y eso no debe cortarle la pregunta al resto.
   */
  private maybeEndQuestionEarly() {
    if (this.phase !== 'question' || this.players.size === 0) return;
    if ([...this.players.values()].every((p) => p.answers[this.index])) this.endQuestion();
  }

  private bindPlayerSocket(player: Player, socket: TypedSocket) {
    if (player.socketId && player.socketId !== socket.id) {
      this.evictSocket(player.socketId, 'Te conectaste desde otra pestaña o dispositivo');
    }
    player.socketId = socket.id;
    socket.data = { pin: this.pin, role: 'player', playerId: player.id };
    socket.join(this.room);
  }

  /** Saca un socket de la partida (sin desconectarlo) y le avisa por qué. */
  private evictSocket(socketId: string, reason: string) {
    const socket = this.io.sockets.sockets.get(socketId);
    if (!socket) return;
    socket.emit('game:closed', { reason });
    socket.leave(this.room);
    socket.leave(this.hostRoom);
    socket.data = {};
  }

  private armLifecycleTimer(ms: number, reason: string) {
    this.clearLifecycleTimer();
    this.lifecycleTimer = setTimeout(() => this.close(reason), ms);
  }

  private clearLifecycleTimer() {
    clearTimeout(this.lifecycleTimer);
    this.lifecycleTimer = undefined;
  }

  private async persist() {
    if (!this.startedAt || this.players.size === 0) return;
    const played = this.index + 1;
    const quizStillExists = (await prisma.quiz.count({ where: { id: this.quiz.id } })) > 0;
    await prisma.game.create({
      data: {
        quizId: quizStillExists ? this.quiz.id : null,
        quizTitle: this.quiz.title,
        pin: this.pin,
        startedAt: this.startedAt,
        finishedAt: new Date(),
        players: {
          create: rankPlayers([...this.players.values()]).map(({ player, rank }) => ({
            nickname: player.nickname,
            score: player.score,
            rank,
            answers: {
              create: this.quiz.questions.slice(0, played).map((q, i) => {
                const a = player.answers[i];
                return {
                  questionOrder: i,
                  questionText: q.text,
                  choices: a?.choices ?? [],
                  correct: a?.correct ?? false,
                  points: a?.points ?? 0,
                  responseMs: a?.responseMs ?? null,
                };
              }),
            },
          })),
        },
      },
    });
  }
}
