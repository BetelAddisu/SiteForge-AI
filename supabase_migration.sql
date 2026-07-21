-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum types
CREATE TYPE "ProjectStatus" AS ENUM ('DRAFT', 'GENERATING', 'PREVIEW', 'PUBLISHED', 'FAILED');
CREATE TYPE "ImportStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETE', 'FAILED', 'SKIPPED');
CREATE TYPE "AssetType" AS ENUM ('LOGO', 'IMAGE', 'GENERATED_IMAGE', 'PREVIEW', 'DOCUMENT');
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETE', 'FAILED');

-- User table
CREATE TABLE "User" (
  "id" TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  "supabaseId" TEXT UNIQUE NOT NULL,
  "email" TEXT UNIQUE NOT NULL,
  "name" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Project table
CREATE TABLE "Project" (
  "id" TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  "userId" TEXT NOT NULL,
  "businessName" TEXT NOT NULL,
  "industry" TEXT,
  "description" TEXT,
  "logo" TEXT,
  "status" "ProjectStatus" NOT NULL DEFAULT 'DRAFT',
  "templateId" TEXT,
  "kitId" TEXT,
  "templateSource" TEXT,
  "stylePreset" TEXT,
  "brandColors" JSONB,
  "brandTokens" JSONB,
  "businessInfo" JSONB,
  "checkpoint" TEXT,
  "checkpointData" JSONB,
  "generatedContent" JSONB,
  "elementorData" JSONB,
  "previewImage" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

-- TemplateKit table
CREATE TABLE "TemplateKit" (
  "id" TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  "name" TEXT NOT NULL,
  "slug" TEXT UNIQUE NOT NULL,
  "description" TEXT,
  "industry" TEXT,
  "style" TEXT,
  "previewImage" TEXT,
  "thumbnailImage" TEXT,
  "primaryColor" TEXT,
  "secondaryColor" TEXT,
  "accentColor" TEXT,
  "typography" JSONB,
  "templateCount" INTEGER NOT NULL DEFAULT 0,
  "categories" TEXT[],
  "globalStyles" JSONB,
  "storageProvider" TEXT NOT NULL DEFAULT 'r2',
  "storageKey" TEXT,
  "filePath" TEXT,
  "importStatus" "ImportStatus" NOT NULL DEFAULT 'PENDING',
  "importError" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Template table
CREATE TABLE "Template" (
  "id" TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "industry" TEXT,
  "style" TEXT,
  "kitId" TEXT,
  "kitSlug" TEXT,
  "kitName" TEXT,
  "storageProvider" TEXT NOT NULL DEFAULT 'r2',
  "storageKey" TEXT NOT NULL,
  "extractedPath" TEXT,
  "filePath" TEXT,
  "previewImage" TEXT,
  "metadata" JSONB,
  "tags" TEXT[],
  "globalStyles" JSONB,
  "importStatus" "ImportStatus" NOT NULL DEFAULT 'PENDING',
  "importError" TEXT,
  "compatibilityScore" INTEGER,
  "compatibilityNotes" JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "Template_kitId_fkey" FOREIGN KEY ("kitId") REFERENCES "TemplateKit"("id") ON DELETE SET NULL
);

-- TemplateSection table
CREATE TABLE "TemplateSection" (
  "id" TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  "templateId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT,
  "content" JSONB NOT NULL,
  "metadata" JSONB,
  CONSTRAINT "TemplateSection_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE CASCADE
);

-- TemplateVersion table
CREATE TABLE "TemplateVersion" (
  "id" TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  "templateId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "snapshot" JSONB NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "TemplateVersion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE CASCADE
);

-- Asset table
CREATE TABLE "Asset" (
  "id" TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  "projectId" TEXT NOT NULL,
  "type" "AssetType" NOT NULL,
  "url" TEXT NOT NULL,
  "filename" TEXT,
  "mimeType" TEXT,
  "size" INTEGER,
  "metadata" JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "Asset_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE
);

-- AIJob table
CREATE TABLE "AIJob" (
  "id" TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  "projectId" TEXT,
  "type" TEXT NOT NULL,
  "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
  "input" JSONB,
  "output" JSONB,
  "error" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "startedAt" TIMESTAMPTZ,
  "completedAt" TIMESTAMPTZ,
  CONSTRAINT "AIJob_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL
);

-- AIUsage table
CREATE TABLE "AIUsage" (
  "id" TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  "aiJobId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "inputTokens" INTEGER NOT NULL,
  "outputTokens" INTEGER NOT NULL,
  "costUsd" DOUBLE PRECISION NOT NULL,
  "latencyMs" INTEGER,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "AIUsage_aiJobId_fkey" FOREIGN KEY ("aiJobId") REFERENCES "AIJob"("id") ON DELETE CASCADE
);

-- ProcessingJob table
CREATE TABLE "ProcessingJob" (
  "id" TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  "templateId" TEXT,
  "stage" TEXT NOT NULL,
  "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
  "progress" INTEGER,
  "error" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "startedAt" TIMESTAMPTZ,
  "completedAt" TIMESTAMPTZ,
  CONSTRAINT "ProcessingJob_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE SET NULL
);

-- Deployment table
CREATE TABLE "Deployment" (
  "id" TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  "projectId" TEXT NOT NULL,
  "wordpressUrl" TEXT NOT NULL,
  "pageId" TEXT,
  "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
  "logs" JSONB,
  "error" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "completedAt" TIMESTAMPTZ,
  CONSTRAINT "Deployment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE
);

-- WordPressConnection table
CREATE TABLE "WordPressConnection" (
  "id" TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  "userId" TEXT UNIQUE NOT NULL,
  "siteUrl" TEXT NOT NULL,
  "username" TEXT NOT NULL,
  "appPassword" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX "User_supabaseId_idx" ON "User"("supabaseId");
CREATE INDEX "User_email_idx" ON "User"("email");
CREATE INDEX "Project_userId_idx" ON "Project"("userId");
CREATE INDEX "Project_status_idx" ON "Project"("status");
CREATE INDEX "Project_createdAt_idx" ON "Project"("createdAt");
CREATE INDEX "Project_kitId_idx" ON "Project"("kitId");
CREATE INDEX "TemplateKit_industry_idx" ON "TemplateKit"("industry");
CREATE INDEX "TemplateKit_style_idx" ON "TemplateKit"("style");
CREATE INDEX "TemplateKit_importStatus_idx" ON "TemplateKit"("importStatus");
CREATE INDEX "Template_category_idx" ON "Template"("category");
CREATE INDEX "Template_industry_idx" ON "Template"("industry");
CREATE INDEX "Template_kitId_idx" ON "Template"("kitId");
CREATE INDEX "Template_kitSlug_idx" ON "Template"("kitSlug");
CREATE INDEX "Template_compatibilityScore_idx" ON "Template"("compatibilityScore");
CREATE INDEX "Template_importStatus_idx" ON "Template"("importStatus");
CREATE INDEX "TemplateSection_templateId_idx" ON "TemplateSection"("templateId");
CREATE INDEX "TemplateSection_type_idx" ON "TemplateSection"("type");
CREATE INDEX "TemplateVersion_templateId_idx" ON "TemplateVersion"("templateId");
CREATE INDEX "Asset_projectId_idx" ON "Asset"("projectId");
CREATE INDEX "Asset_type_idx" ON "Asset"("type");
CREATE INDEX "AIJob_projectId_idx" ON "AIJob"("projectId");
CREATE INDEX "AIJob_status_idx" ON "AIJob"("status");
CREATE INDEX "AIJob_type_idx" ON "AIJob"("type");
CREATE INDEX "AIJob_createdAt_idx" ON "AIJob"("createdAt");
CREATE INDEX "AIUsage_aiJobId_idx" ON "AIUsage"("aiJobId");
CREATE INDEX "AIUsage_createdAt_idx" ON "AIUsage"("createdAt");
CREATE INDEX "AIUsage_provider_idx" ON "AIUsage"("provider");
CREATE INDEX "ProcessingJob_templateId_idx" ON "ProcessingJob"("templateId");
CREATE INDEX "ProcessingJob_stage_idx" ON "ProcessingJob"("stage");
CREATE INDEX "ProcessingJob_status_idx" ON "ProcessingJob"("status");
CREATE INDEX "Deployment_projectId_idx" ON "Deployment"("projectId");
CREATE INDEX "Deployment_status_idx" ON "Deployment"("status");
CREATE INDEX "WordPressConnection_userId_idx" ON "WordPressConnection"("userId");

-- Create unique constraints
CREATE UNIQUE INDEX "Template_kitId_slug_key" ON "Template"("kitId", "slug");
CREATE UNIQUE INDEX "TemplateVersion_templateId_version_key" ON "TemplateVersion"("templateId", "version");
