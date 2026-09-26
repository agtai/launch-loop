export function countXText(text: string): {weightedLength: number; valid: boolean; maxLength: number; remaining: number; version: string};
export function validateXDocument(document: unknown, options?: {allowEmpty?: boolean; checkLength?: boolean}): string[];
