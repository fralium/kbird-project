import HomePageClient from './HomePageClient';
import { listPublicBackgrounds } from '../data/listPublicBackgrounds';

export default function Page() {
  const backgrounds = listPublicBackgrounds();
  return <HomePageClient backgrounds={backgrounds} />;
}
