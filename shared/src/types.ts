import type { QuestionInput } from './schemas';

export interface QuizSummary {
  id: string;
  title: string;
  questionCount: number;
  updatedAt: string;
}

export interface QuizDetail {
  id: string;
  title: string;
  questions: (QuestionInput & { id: string })[];
}

export interface UploadImageResponse {
  id: string;
}

export interface ApiError {
  error: string;
  issues?: { path: string; message: string }[];
}
