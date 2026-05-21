export function getPosition(domId, center = ['50%', '50%']) {
  const dom = document.querySelector('#' + domId)
  if (!dom) return {}
  const domWidth = dom.clientWidth
  const domHeight = dom.clientHeight
  const size = Math.min(domWidth, domHeight)
  const left = Number.isFinite(domWidth) && typeof center[0] === 'string'
    ? (domWidth * parseFloat(center[0])) / 100 - size / 2
    : center[0] - size / 2
  const top = Number.isFinite(domHeight) && typeof center[1] === 'string'
    ? (domHeight * parseFloat(center[1])) / 100 - size / 2
    : center[1] - size / 2

  return { size, left, top }
}

export const base64Url = {
  image: ''
}
export default (domId, center = ['50%', '50%'], imageSrc, zoom) => {
  const { size, top, left } = getPosition(domId, center)
  if (!size) return
  const result = [{
    type: 'group', left, top, children: [
      {
        type: 'image',
        style: {
          image: imageSrc ?? base64Url.image,
          width: size * (zoom ?? 0.6),
          height: size * (zoom ?? 0.6),
        },
        left: 'center',
        top: 'center',
      },
      {
        type: 'rect',
        shape: { width: size, height: size },
        style: { fill: 'transparent' },
        left: 'center',
        top: 'center',
      },
    ],
  }]
  return result
}
