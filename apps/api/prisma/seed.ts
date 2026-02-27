import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const scenarios = [
    {
      slug: 'url-shortener',
      title: 'Design a URL Shortener',
      description: 'Build a highly available short-link service with analytics.',
      difficulty: 'beginner',
      domain: 'storage',
      estimatedMinutes: 35,
      expectedRps: 10000
    },
    {
      slug: 'twitter-feed',
      title: 'Design a Twitter-like News Feed',
      description: 'Serve personalized timelines with high fan-out and low latency.',
      difficulty: 'advanced',
      domain: 'feed',
      estimatedMinutes: 60,
      expectedRps: 150000
    },
    {
      slug: 'realtime-chat',
      title: 'Design a Realtime Chat System',
      description: 'Handle persistent connections, message fan-out, and ordering guarantees.',
      difficulty: 'intermediate',
      domain: 'chat',
      estimatedMinutes: 50,
      expectedRps: 50000
    },
    {
      slug: 'video-upload-processing',
      title: 'Design a Video Upload and Processing Pipeline',
      description: 'Ingest, transcode, store, and deliver video content globally.',
      difficulty: 'advanced',
      domain: 'media',
      estimatedMinutes: 65,
      expectedRps: 30000
    },
    {
      slug: 'ride-matching',
      title: 'Design a Ride Matching Service',
      description: 'Match riders to nearby drivers with geo-partitioning and low latency.',
      difficulty: 'intermediate',
      domain: 'marketplace',
      estimatedMinutes: 55,
      expectedRps: 70000
    }
  ];

  for (const scenario of scenarios) {
    await prisma.scenario.upsert({
      where: { slug: scenario.slug },
      update: {
        title: scenario.title,
        description: scenario.description,
        difficulty: scenario.difficulty,
        domain: scenario.domain,
        estimatedMinutes: scenario.estimatedMinutes,
        expectedRps: scenario.expectedRps,
        isActive: true
      },
      create: {
        ...scenario,
        isActive: true
      }
    });
  }

  console.log(`Seeded ${scenarios.length} scenarios.`);
}

main()
  .catch((error) => {
    console.error('Seed failed', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
