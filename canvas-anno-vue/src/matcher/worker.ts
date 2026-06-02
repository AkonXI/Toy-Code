/**
 * Web Worker — 将比对算法的 O(n×m) 计算移出主线程
 */
import { matchTrajectory } from './matcher'

self.onmessage = (e: MessageEvent) => {
  const { curveA, curveB, options } = e.data
  try {
    const result = matchTrajectory(curveA, curveB, options)
    self.postMessage({ result })
  } catch (err: any) {
    self.postMessage({ error: err.message })
  }
}
