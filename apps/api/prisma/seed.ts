import { prisma } from "../src/db/prisma";
import { hashPassword } from "../src/utils/password";
import { DEFAULT_SITE_CONTENT } from "../src/modules/site/site.service";
import { onboardingService } from "../src/modules/onboarding/onboarding.service";

async function main() {
  const coachEmail = "coach@demo.com";
  const memberEmail = "member@demo.com";

  // Coach
  const coachUser = await prisma.user.upsert({
    where: { email: coachEmail },
    update: {},
    create: {
      email: coachEmail,
      passwordHash: await hashPassword("Password123!"),
      role: "COACH",
      coachProfile: {
        create: {
          brandName: "Coach Demo",
          tagline: "Transforme ton corps, garde ton mental.",
          primaryColor: "#0ea5e9",
          isActive: true
        }
      }
    }
  });

  // Member
  const member = await prisma.user.upsert({
    where: { email: memberEmail },
    update: {},
    create: {
      email: memberEmail,
      passwordHash: await hashPassword("Password123!"),
      role: "MEMBER",
      memberProfile: { create: { fullName: "Alex Client", goal: "Perte de poids", level: "Débutant", isActivated: true } }
    }
  });
  const memberProfile = await prisma.memberProfile.findUnique({ where: { userId: member.id } });
  if (memberProfile) {
    await onboardingService.seedForMember(memberProfile.id);
    await prisma.sessionRecap.deleteMany({ where: { memberId: memberProfile.id } });
    await prisma.sessionRecap.create({
      data: {
        memberId: memberProfile.id,
        sessionDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        focus: "Force • Lower",
        intensity: "RPE 8",
        notes: "Travail lourd + emphasis tempo.",
        exercisesJson: JSON.stringify([
          { name: "Back Squat", sets: "5", reps: "5", tempo: "31X1", rest: "150s" },
          { name: "Front Foot Elevated Split Squat", sets: "4", reps: "8/side", rest: "90s" },
          { name: "Nordic Curl", sets: "3", reps: "6", rest: "120s" }
        ])
      }
    });
    await prisma.sessionRecap.create({
      data: {
        memberId: memberProfile.id,
        sessionDate: new Date(),
        focus: "Upper pump",
        intensity: "RPE 7",
        notes: "Volume + tempo contrôlé, finir par gainage.",
        exercisesJson: JSON.stringify([
          { name: "Bench Press tempo", sets: "4", reps: "8", tempo: "3010", rest: "120s" },
          { name: "Seated Row", sets: "4", reps: "12", rest: "90s" },
          { name: "DB Shoulder Press", sets: "3", reps: "12", rest: "60s" }
        ])
      }
    });
  }

  const coachProfile = await prisma.coachProfile.findUniqueOrThrow({
    where: { userId: coachUser.id }
  });

  const starterTemplateTitle = "Onboarding starter";
  const starterTemplateDescription = "Checklist automatique générée lors des nouvelles inscriptions.";
  const starterTemplateSteps = [
    { title: "Questionnaire détaillé", description: "Remplir le formulaire habitudes + historique blessures.", dueOffsetDays: 1 },
    { title: "Photos / mesures", description: "Envoyer 3 photos + mensurations clés.", dueOffsetDays: 2 },
    { title: "Connexion outils", description: "Partager calendrier, app de tracking ou Google Sheet.", dueOffsetDays: 3 }
  ];

  await prisma.$transaction(async (tx) => {
    const existingTemplate = await tx.onboardingTemplate.findFirst({
      where: { coachId: coachProfile.id, title: starterTemplateTitle },
      include: { steps: true }
    });

    if (!existingTemplate) {
      await tx.onboardingTemplate.create({
        data: {
          coachId: coachProfile.id,
          title: starterTemplateTitle,
          description: starterTemplateDescription,
          steps: {
            create: starterTemplateSteps.map((step, index) => ({
              title: step.title,
              description: step.description,
              dueOffsetDays: step.dueOffsetDays,
              orderIndex: index,
              autoEmail: false,
              autoSms: false
            }))
          }
        }
      });
      return;
    }

    await tx.onboardingTemplate.update({
      where: { id: existingTemplate.id },
      data: { description: starterTemplateDescription }
    });

    await tx.onboardingTemplateStep.deleteMany({ where: { templateId: existingTemplate.id } });
    await tx.onboardingTemplateStep.createMany({
      data: starterTemplateSteps.map((step, index) => ({
        templateId: existingTemplate.id,
        title: step.title,
        description: step.description,
        dueOffsetDays: step.dueOffsetDays,
        orderIndex: index,
        autoEmail: false,
        autoSms: false
      }))
    });
  });

  const site = DEFAULT_SITE_CONTENT;
  await prisma.coachSite.upsert({
    where: { coachId: coachProfile.id },
    update: {
      heroEyebrow: site.heroEyebrow,
      heroTitle: site.heroTitle,
      heroHighlight: site.heroHighlight,
      heroDescription: site.heroDescription,
      heroPrimaryImage: site.heroPrimaryImage,
      heroSecondaryImage: site.heroSecondaryImage,
      heroStats: JSON.stringify(site.heroStats),
      features: JSON.stringify(site.features),
      focusBlocks: JSON.stringify(site.focusBlocks),
      coachName: site.coach.name,
      coachRole: site.coach.role,
      coachBio: site.coach.bio,
      coachPhoto: site.coach.photo,
      coachStats: JSON.stringify(site.coach.stats),
      testimonials: JSON.stringify(site.testimonials),
      reviews: JSON.stringify(site.reviews),
      methodSteps: JSON.stringify(site.methodSteps),
      carouselSlides: JSON.stringify(site.carouselSlides),
      palette: JSON.stringify(site.palette),
      fontFamily: site.fontFamily,
      ctaPrimary: site.ctaPrimary,
      ctaSecondary: site.ctaSecondary
    },
    create: {
      coachId: coachProfile.id,
      heroEyebrow: site.heroEyebrow,
      heroTitle: site.heroTitle,
      heroHighlight: site.heroHighlight,
      heroDescription: site.heroDescription,
      heroPrimaryImage: site.heroPrimaryImage,
      heroSecondaryImage: site.heroSecondaryImage,
      heroStats: JSON.stringify(site.heroStats),
      features: JSON.stringify(site.features),
      focusBlocks: JSON.stringify(site.focusBlocks),
      coachName: site.coach.name,
      coachRole: site.coach.role,
      coachBio: site.coach.bio,
      coachPhoto: site.coach.photo,
      coachStats: JSON.stringify(site.coach.stats),
      testimonials: JSON.stringify(site.testimonials),
      reviews: JSON.stringify(site.reviews),
      methodSteps: JSON.stringify(site.methodSteps),
      carouselSlides: JSON.stringify(site.carouselSlides),
      palette: JSON.stringify(site.palette),
      fontFamily: site.fontFamily,
      ctaPrimary: site.ctaPrimary,
      ctaSecondary: site.ctaSecondary
    }
  });

  // Produits: on nettoie puis on recrée (seed idempotent)
  await prisma.product.deleteMany({ where: { coachId: coachProfile.id } });

  await prisma.product.createMany({
    data: [
      {
        coachId: coachProfile.id,
        title: "Pack Recomposition",
        description: "12 semaines avec plan nutrition, photos de suivi et adaptation totale.",
        priceCents: 59900,
        billingInterval: "ONE_TIME",
        checkoutUrl: "https://buy.stripe.com/test_recomposition",
        activeSubscribers: 18,
        isActive: true,
        creditValue: 12
      },
      {
        coachId: coachProfile.id,
        title: "Coaching signature",
        description: "Abonnement mensuel avec check caméra + accès app + support WhatsApp.",
        priceCents: 14900,
        billingInterval: "MONTHLY",
        checkoutUrl: "https://buy.stripe.com/test_signature",
        activeSubscribers: 42,
        isActive: true,
        creditValue: null
      },
      {
        coachId: coachProfile.id,
        title: "Pack Performance",
        description: "Bloc intensif 8 semaines + tests lab + protocole mindset.",
        priceCents: 89000,
        billingInterval: "ONE_TIME",
        checkoutUrl: "https://buy.stripe.com/test_performance",
        activeSubscribers: 9,
        isActive: true,
        creditValue: 8
      }
    ]
  });

  if (memberProfile) {
    await prisma.memberProfile.update({ where: { id: memberProfile.id }, data: { isActivated: true } });
    await prisma.memberPack.deleteMany({ where: { memberId: memberProfile.id } });
    const sampleProduct = await prisma.product.findFirst({ where: { coachId: coachProfile.id }, orderBy: { createdAt: "asc" } });
    if (sampleProduct) {
      await prisma.memberPack.create({
        data: {
          memberId: memberProfile.id,
          productId: sampleProduct.id,
          totalCredits: sampleProduct.creditValue ?? null,
          creditsRemaining: sampleProduct.creditValue ?? null,
          status: "ACTIVE",
          metadata: JSON.stringify({ seed: true })
        }
      });
    }

    await prisma.payment.deleteMany({ where: { memberId: memberProfile.id } });
    await prisma.payment.createMany({
      data: [
        {
          memberId: memberProfile.id,
          amountCents: 59900,
          currency: "EUR",
          method: "STRIPE",
          status: "PAID",
          providerRef: "stripe_demo_payment_intent",
          metadata: JSON.stringify({
            provider: "STRIPE",
            description: "Pack Recomposition",
            checkoutUrl: "https://buy.stripe.com/test_recomposition"
          })
        },
        {
          memberId: memberProfile.id,
          amountCents: 14900,
          currency: "EUR",
          method: "CASH",
          status: "PENDING",
          notes: "À encaisser avant la séance",
          metadata: JSON.stringify({
            provider: "CASH",
            description: "Séance drop-in"
          })
        }
      ]
    });
  }

  // Dispos: on nettoie puis on recrée
  await prisma.availability.deleteMany({ where: { coachId: coachProfile.id } });

  const now = new Date();
  const start = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  start.setHours(10, 0, 0, 0);
  const end = new Date(start.getTime() + 60 * 60 * 1000);

  await prisma.availability.create({
    data: { coachId: coachProfile.id, startAt: start, endAt: end }
  });

  await prisma.coachIntegrationSettings.upsert({
    where: { coachId: coachProfile.id },
    update: {},
    create: {
      coachId: coachProfile.id,
      stripePublicKey: "pk_test_demo",
      stripeSecretKey: "sk_test_demo",
      stripeWebhookSecret: "whsec_demo"
    }
  });

  console.log("Seed OK ✅");
  console.log("Coach:", coachEmail, "Password123!");
  console.log("Member:", memberEmail, "Password123!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
