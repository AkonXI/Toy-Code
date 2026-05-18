import type { Group } from './types';

export const DEFAULT_GROUPS: Group[] = [
  { name: 'red',    stroke: '#e53935', fill: 'rgba(229,57,53,0.12)', fillHover: 'rgba(229,57,53,0.04)', label: '红' },
  { name: 'yellow', stroke: '#f9a825', fill: 'rgba(249,168,37,0.12)', fillHover: 'rgba(249,168,37,0.04)', label: '黄' },
  { name: 'blue',   stroke: '#1e88e5', fill: 'rgba(30,136,229,0.12)', fillHover: 'rgba(30,136,229,0.04)', label: '蓝' },
  { name: 'green',  stroke: '#43a047', fill: 'rgba(67,160,71,0.12)', fillHover: 'rgba(67,160,71,0.04)', label: '绿' },
];

export function buildGroupMap(groups: Group[]): Record<string, Group> {
  const map: Record<string, Group> = {};
  groups.forEach(g => { map[g.name] = g; });
  return map;
}

export function deepCopy<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

export function normalizeAngle(delta: number): number {
  while (delta > Math.PI) delta -= 2 * Math.PI;
  while (delta < -Math.PI) delta += 2 * Math.PI;
  return delta;
}
