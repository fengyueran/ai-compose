export function isPresetSkillMatch(skillId: string, presetId: string): boolean {
  const normalizedSkillId = skillId.toLowerCase();
  const normalizedPresetId = presetId.toLowerCase();

  return normalizedSkillId === normalizedPresetId
    || normalizedSkillId.endsWith(`/${normalizedPresetId}`)
    || normalizedSkillId.endsWith(`__${normalizedPresetId}`);
}
