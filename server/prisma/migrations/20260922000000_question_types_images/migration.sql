-- Tipos de pregunta
CREATE TYPE "QuestionType" AS ENUM ('single', 'multiple', 'truefalse');

-- Imágenes
CREATE TABLE "Image" (
    "id" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Image_pkey" PRIMARY KEY ("id")
);

-- Question: tipo, imagen y varias respuestas correctas (se conservan los datos de correctIndex)
ALTER TABLE "Question"
    ADD COLUMN "type" "QuestionType" NOT NULL DEFAULT 'single',
    ADD COLUMN "imageId" TEXT,
    ADD COLUMN "correctIndices" INTEGER[];
UPDATE "Question" SET "correctIndices" = ARRAY["correctIndex"];
ALTER TABLE "Question" DROP COLUMN "correctIndex";
ALTER TABLE "Question" ADD CONSTRAINT "Question_imageId_fkey"
    FOREIGN KEY ("imageId") REFERENCES "Image"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- GameAnswer: varias opciones elegidas (vacío = no respondió)
ALTER TABLE "GameAnswer" ADD COLUMN "choices" INTEGER[];
UPDATE "GameAnswer"
    SET "choices" = CASE WHEN "choiceIndex" IS NULL THEN '{}'::INTEGER[] ELSE ARRAY["choiceIndex"] END;
ALTER TABLE "GameAnswer" DROP COLUMN "choiceIndex";
