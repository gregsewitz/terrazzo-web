-- CreateTable
CREATE TABLE "PipelineStageResult" (
    "id" TEXT NOT NULL,
    "pipelineRunId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "output" JSONB,
    "signalCount" INTEGER,
    "durationMs" INTEGER,
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PipelineStageResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PipelineStageResult_pipelineRunId_stageId_key" ON "PipelineStageResult"("pipelineRunId", "stageId");

-- CreateIndex
CREATE INDEX "PipelineStageResult_pipelineRunId_idx" ON "PipelineStageResult"("pipelineRunId");

-- CreateIndex
CREATE INDEX "PipelineStageResult_stageId_idx" ON "PipelineStageResult"("stageId");

-- AddForeignKey
ALTER TABLE "PipelineStageResult" ADD CONSTRAINT "PipelineStageResult_pipelineRunId_fkey" FOREIGN KEY ("pipelineRunId") REFERENCES "PipelineRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
