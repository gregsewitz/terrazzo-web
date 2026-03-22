import type { OnboardingProgressState } from './progressSlice';
import type { OnboardingProfileState } from './profileSlice';
import type { OnboardingContextState } from './contextSlice';
import type { OnboardingMosaicState } from './mosaicSlice';

export type OnboardingState = OnboardingProgressState & OnboardingProfileState & OnboardingContextState & OnboardingMosaicState;
