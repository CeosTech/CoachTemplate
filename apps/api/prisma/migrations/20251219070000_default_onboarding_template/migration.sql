-- Seed a starter onboarding template per coach if none exists
INSERT INTO "OnboardingTemplate" ("id", "coachId", "title", "description", "createdAt", "updatedAt")
SELECT
  printf('starter-template-%s', lower(hex(randomblob(8)))),
  coach."id",
  'Onboarding starter',
  'Checklist automatique générée lors des nouvelles inscriptions.',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "CoachProfile" coach
WHERE NOT EXISTS (
  SELECT 1 FROM "OnboardingTemplate" tpl WHERE tpl."coachId" = coach."id"
);

-- Add default steps only if the template has no steps yet
INSERT INTO "OnboardingTemplateStep" ("id", "templateId", "title", "description", "dueOffsetDays", "autoEmail", "autoSms", "orderIndex", "createdAt")
SELECT printf('starter-step1-%s', lower(hex(randomblob(8)))), tpl."id", 'Questionnaire détaillé', 'Remplir le formulaire habitudes + historique blessures.', 1, 0, 0, 0, CURRENT_TIMESTAMP
FROM "OnboardingTemplate" tpl
WHERE tpl."title" = 'Onboarding starter'
  AND NOT EXISTS (SELECT 1 FROM "OnboardingTemplateStep" step WHERE step."templateId" = tpl."id");

INSERT INTO "OnboardingTemplateStep" ("id", "templateId", "title", "description", "dueOffsetDays", "autoEmail", "autoSms", "orderIndex", "createdAt")
SELECT printf('starter-step2-%s', lower(hex(randomblob(8)))), tpl."id", 'Photos / mesures', 'Envoyer 3 photos + mensurations clés.', 2, 0, 0, 1, CURRENT_TIMESTAMP
FROM "OnboardingTemplate" tpl
WHERE tpl."title" = 'Onboarding starter'
  AND NOT EXISTS (SELECT 1 FROM "OnboardingTemplateStep" step WHERE step."templateId" = tpl."id");

INSERT INTO "OnboardingTemplateStep" ("id", "templateId", "title", "description", "dueOffsetDays", "autoEmail", "autoSms", "orderIndex", "createdAt")
SELECT printf('starter-step3-%s', lower(hex(randomblob(8)))), tpl."id", 'Connexion outils', 'Partager calendrier, app de tracking ou Google Sheet.', 3, 0, 0, 2, CURRENT_TIMESTAMP
FROM "OnboardingTemplate" tpl
WHERE tpl."title" = 'Onboarding starter'
  AND NOT EXISTS (SELECT 1 FROM "OnboardingTemplateStep" step WHERE step."templateId" = tpl."id");
