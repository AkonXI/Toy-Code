import mocks from './mockData'

export async function post(url, params) {
  let match = mocks[url] ?? mocks.default
  if (typeof match === 'function') {
    match = match(params)
  }
  return new Promise((resolve) => {
    setTimeout(() => resolve(JSON.parse(JSON.stringify(match))), 200 + Math.random() * 300)
  })
}

export async function get(url, _params) {
  return post(url, _params)
}
