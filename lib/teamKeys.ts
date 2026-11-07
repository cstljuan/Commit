import { decryptForTeam, getPublicKeys, newTeamKey, unwrapTeamKey, wrapTeamKeyFor } from './crypto';
import { cyberUser, getCyberClient } from './vault';

export function createTeamKey(): { key: string } { return { key: newTeamKey() }; }
async function profileKeys(userId: string) {
  const { data, error } = await getCyberClient().from('profiles').select('box_public_key,sign_public_key').eq('id', userId).single();
  if (error) throw error;
  if (!data.box_public_key) throw new Error('This member has not registered device keys');
  return data;
}
async function assertDevice(userId: string) {
  const remote = await profileKeys(userId);
  const local = await getPublicKeys();
  if (remote.box_public_key !== local.boxPublicKey || remote.sign_public_key !== local.signPublicKey) throw new Error('This account uses different device keys');
  return local;
}
export async function storeOwnTeamKey(projectId: string, key: string): Promise<void> {
  const userId = await cyberUser();
  const local = await assertDevice(userId);
  const { data: existing, error: readError } = await getCyberClient().from('team_keys').select('project_id').eq('project_id', projectId).eq('user_id', userId).maybeSingle();
  if (readError) throw readError;
  if (existing) throw new Error('A team key already exists. Do not replace it.');
  const { error } = await getCyberClient().from('team_keys').insert({
    project_id: projectId, user_id: userId, sender_public_key: local.boxPublicKey,
    ...await wrapTeamKeyFor(local.boxPublicKey, key),
  });
  if (error) throw error;
}
async function ownKey(projectId: string, userId: string): Promise<string> {
  await assertDevice(userId);
  const { data, error } = await getCyberClient().from('team_keys').select('encrypted_team_key,nonce,sender_public_key').eq('project_id', projectId).eq('user_id', userId).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Waiting for the project owner to share this team key');
  // Only the owner's key is a valid sender. Do not trust a substituted sender key.
  const { data: project, error: projectError } = await getCyberClient().from('projects').select('owner_id').eq('id', projectId).single();
  if (projectError) throw projectError;
  if ((await profileKeys(project.owner_id)).box_public_key !== data.sender_public_key) throw new Error('Team key sender does not match the owner');
  return unwrapTeamKey(data.encrypted_team_key, data.nonce, data.sender_public_key);
}
export async function shareTeamKey(projectId: string, memberId: string): Promise<void> {
  const userId = await cyberUser();
  const { data: project, error: projectError } = await getCyberClient().from('projects').select('owner_id').eq('id', projectId).single();
  if (projectError) throw projectError;
  if (project.owner_id !== userId) throw new Error('Only the owner can share a team key');
  const { data: members, error: memberError } = await getCyberClient().from('team_members').select('user_id').eq('project_id', projectId).eq('user_id', memberId).eq('status', 'active');
  if (memberError) throw memberError;
  if (!members?.length) throw new Error('Both people must commit before a key can be shared');
  const key = await ownKey(projectId, userId);
  const { error } = await getCyberClient().from('team_keys').insert({
    project_id: projectId, user_id: memberId, sender_public_key: (await getPublicKeys()).boxPublicKey,
    ...await wrapTeamKeyFor((await profileKeys(memberId)).box_public_key, key),
  });
  // A retry must preserve the existing wrapped key.
  if (error && error.code !== '23505') throw error;
}
export async function readIdea(projectId: string): Promise<string> {
  const userId = await cyberUser();
  const { data, error } = await getCyberClient().from('projects').select('visibility,idea_public,idea_cipher,idea_nonce').eq('id', projectId).single();
  if (error) throw error;
  if (data.visibility === 'public') return data.idea_public ?? '';
  if (!data.idea_cipher || !data.idea_nonce) throw new Error('No encrypted idea is available');
  return decryptForTeam(data.idea_cipher, data.idea_nonce, await ownKey(projectId, userId));
}
