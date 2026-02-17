import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest';
import { placeIntelligencePipeline } from '@/lib/pipeline';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [placeIntelligencePipeline],
});