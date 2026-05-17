export interface EmojiOptions {
  status: boolean
  emojis: string[]
  duration: number
  min: number
  max: number
  stay: number
  opacity: number
}

const initOption: EmojiOptions = {
  status: true,
  emojis: [],
  duration: 250,
  min: 15,
  max: 30,
  stay: 1000,
  opacity: 1
}

export default initOption
