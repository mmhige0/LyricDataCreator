// @vitest-environment jsdom
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { executeTypingInput } from 'lyrics-typing-engine'
import { TypingDisplay } from '../components/TypingDisplay'
import { LyricsText } from '../components/LyricsText'
import { createTypingWordForPageLines, skipSpaces } from '../lib/typingEngineAdapter'

const lines = ['★か１２な！？', '𠮷あ', '', '']
function render(word: ReturnType<typeof createTypingWordForPageLines>) {
  const host = document.createElement('div')
  host.innerHTML = renderToStaticMarkup(<TypingDisplay lines={lines} typingWord={word} targetLineIndexes={[0, 1]} />)
  return host
}
it('shows symbols without advancing typing targets and keeps highlighting aligned across skipped characters', () => {
  let word = skipSpaces(createTypingWordForPageLines({ scoreEntries: [{ id: 'page', timestamp: 0, lyrics: lines as [string, string, string, string] }], totalDuration: 30, pageIndex: 0, targetLineIndexes: [0, 1] })!)
  let host = render(word)
  expect(host.querySelector('p')?.textContent).toBe(lines[0])
  expect([...host.querySelectorAll('[data-display-only]')].map(el => el.textContent).join('')).toBe('★１２！？𠮷')
  for (const key of 'kana') {
    const result = executeTypingInput({ typingWord: word, inputChar: key, inputMode: 'roma' })
    expect(result.successKey).toBeTruthy()
    word = skipSpaces(result.nextTypingWord)
  }
  host = render(word)
  expect(host.querySelectorAll('p')[1].querySelector('.text-primary')?.textContent).toBe('あ')
  expect(host.querySelectorAll('p')[1].textContent).toBe('𠮷あ')
  const result = executeTypingInput({ typingWord: word, inputChar: 'a', inputMode: 'roma' })
  expect(skipSpaces(result.nextTypingWord).nextChunk.kana).toBe('')
  expect(render(skipSpaces(result.nextTypingWord)).textContent).toContain('★か１２な！？')
})
it('colors display-only characters in previews and preserves decoration text as a single display-only line', () => {
  const host = document.createElement('div')
  host.innerHTML = renderToStaticMarkup(<><LyricsText text="カ１★漢Ａ" /><TypingDisplay lines={[]} typingWord={null} hideBaseLines overlayLines={['カ１★漢Ａ', 'A/B!']} overlayDecorations={[false, true]} /></>)
  const preview = host.querySelectorAll('p')
  expect(preview[0].textContent).toBe('カ１★漢Ａ')
  expect([...preview[0].querySelectorAll('[data-display-only]')].map(el => el.textContent).join('')).toBe('１★漢')
  expect(preview[1].textContent).toBe('A/B!')
  expect(preview[1].querySelector('[data-display-only]')).toBeNull()
})
