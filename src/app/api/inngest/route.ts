import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest';
import { placeIntelligencePipeline } from '@/lib/pipeline';

// Vercel Pro max: 300s. Needed because individual pipeline stages
// (editorial_extraction, instagram_analysis) can take 3-5 minutes
// due to Apify calls + Claude analysis.
export const maxDuration = 300;

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [placeIntelligencePipeline],
});