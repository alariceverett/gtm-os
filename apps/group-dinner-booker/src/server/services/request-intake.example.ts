import { intakeAndShortlist } from './request-intake.service';

const intake = {
  title: 'Friday Team Dinner',
  eventDate: '2026-03-06',
  timeWindowStart: '18:00',
  timeWindowEnd: '20:30',
  minPartySize: 8,
  maxPartySize: 10,
  neighborhoods: ['West Village', 'SoHo'],
  budgetBand: '$$$' as const,
  dietaryNotes: '1 gluten-free, 1 vegetarian',
  accessibilityNotes: 'Step-free entry preferred',
};

const candidates = [
  {
    id: 'c1',
    name: 'Blue Willow',
    neighborhood: 'West Village',
    budgetBand: '$$$' as const,
    supportsLargeParty: true,
    supportsDietary: true,
    supportsAccessibility: true,
    platformUrls: { resy: 'https://resy.com/example' },
  },
  {
    id: 'c2',
    name: 'Canal House',
    neighborhood: 'Tribeca',
    budgetBand: '$$$$' as const,
    supportsLargeParty: true,
    supportsDietary: false,
    supportsAccessibility: true,
    platformUrls: { direct: 'https://canal-house.example/reservations' },
  },
];

const result = intakeAndShortlist(intake, candidates, 3);

// eslint-disable-next-line no-console
console.log(JSON.stringify(result, null, 2));
