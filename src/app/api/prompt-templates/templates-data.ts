// Re-export from split files for backward compatibility
import { PROMPT_TEMPLATES_PART_1 } from './templates-data-1';
import { PROMPT_TEMPLATES_PART_2 } from './templates-data-2';

export const PROMPT_TEMPLATES = [...PROMPT_TEMPLATES_PART_1, ...PROMPT_TEMPLATES_PART_2];
