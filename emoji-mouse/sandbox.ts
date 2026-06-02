export const life = 42

window.addEventListener('message', async function (event: MessageEvent) {
  const source = event.source as {
    window: WindowProxy
  }

  source.window.postMessage(eval(event.data as string), event.origin)
})
