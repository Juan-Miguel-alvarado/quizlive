-- Puntaje configurable por trivia
ALTER TABLE "Quiz"
    ADD COLUMN "pointsCorrect" INTEGER NOT NULL DEFAULT 100,
    ADD COLUMN "speedBonusMax" INTEGER NOT NULL DEFAULT 50;

-- Series: grupos de preguntas dentro de una trivia
CREATE TABLE "Series" (
    "id" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "title" TEXT NOT NULL,

    CONSTRAINT "Series_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Series_quizId_order_key" ON "Series"("quizId", "order");
ALTER TABLE "Series" ADD CONSTRAINT "Series_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Las trivias que ya existían quedan con una sola "Serie 1" con todas sus preguntas
INSERT INTO "Series" ("id", "quizId", "order", "title")
SELECT 'serie1_' || "id", "id", 0, 'Serie 1' FROM "Quiz";

ALTER TABLE "Question" ADD COLUMN "seriesId" TEXT;
UPDATE "Question" SET "seriesId" = 'serie1_' || "quizId";
ALTER TABLE "Question" ALTER COLUMN "seriesId" SET NOT NULL;
ALTER TABLE "Question" ADD CONSTRAINT "Question_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series"("id") ON DELETE CASCADE ON UPDATE CASCADE;
