import type { Group } from './types'

/** 默认 4 个标注分组：红/黄/蓝/绿 */
export const DEFAULT_GROUPS: Group[] = [
  {
    name: 'red',
    stroke: '#e53935',
    fill: 'rgba(229,57,53,0.12)',
    fillHover: 'rgba(229,57,53,0.04)',
    label: '红'
  },
  {
    name: 'yellow',
    stroke: '#f9a825',
    fill: 'rgba(249,168,37,0.12)',
    fillHover: 'rgba(249,168,37,0.04)',
    label: '黄'
  },
  {
    name: 'blue',
    stroke: '#1e88e5',
    fill: 'rgba(30,136,229,0.12)',
    fillHover: 'rgba(30,136,229,0.04)',
    label: '蓝'
  },
  {
    name: 'green',
    stroke: '#43a047',
    fill: 'rgba(67,160,71,0.12)',
    fillHover: 'rgba(67,160,71,0.04)',
    label: '绿'
  }
]

/**
 * 将分组数组转为 name → Group 的字典
 * @param groups - 分组配置数组
 * @returns name 到 Group 的映射表
 */
export function buildGroupMap(groups: Group[]): Record<string, Group> {
  const map: Record<string, Group> = {}
  groups.forEach((g) => {
    map[g.name] = g
  })
  return map
}

/**
 * 深拷贝（基于 structuredClone）
 * @param obj - 任意可克隆对象
 * @returns 深拷贝副本
 */
export function deepCopy<T>(obj: T): T {
  return structuredClone(obj)
}

/**
 * 将角度归约到 (-π, π] 范围
 * @param delta - 原始角度（弧度）
 * @returns 归一化后的角度
 */
export function normalizeAngle(delta: number): number {
  while (delta > Math.PI) delta -= 2 * Math.PI
  while (delta < -Math.PI) delta += 2 * Math.PI
  return delta
}
