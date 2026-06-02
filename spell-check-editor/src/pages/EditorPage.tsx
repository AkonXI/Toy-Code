import { useRef, useState, useCallback } from 'react'
import { Editor } from '@tinymce/tinymce-react'
import { useErrorDict } from '../context/ErrorDictContext'
import { Link } from 'react-router-dom'
import { setupTinyMCESpellCheck, type SpellCheckAPI } from '../utils/tinymceSetup'
import type { ErrorTrayItem } from '../utils/spellCheck'

export default function EditorPage() {
  const { getErrorMap } = useErrorDict()
  const editorRef = useRef<any>(null)
  const apiRef = useRef<SpellCheckAPI | null>(null)
  const [errorList, setErrorList] = useState<ErrorTrayItem[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [checkCount, setCheckCount] = useState(0)
  const [editorReady, setEditorReady] = useState(false)
  const errorMap = getErrorMap()

  const handleSelectError = useCallback((errorId: string) => {
    setSelectedId(errorId)
    if (apiRef.current) {
      apiRef.current.setSelectedError(errorId)
    }
    const span = editorRef.current
      ?.getBody()
      .querySelector(`[data-error-id="${errorId}"]`) as HTMLElement | null
    if (span) {
      span.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [])

  const handleReplace = useCallback((errorId: string, suggestion: string) => {
    if (apiRef.current) {
      apiRef.current.replaceById(errorId, suggestion)
      setErrorList((prev) => prev.filter((e) => e.errorId !== errorId))
      setSelectedId(null)
      if (apiRef.current) apiRef.current.setSelectedError('')
    }
  }, [])

  return (
    <div className="max-w-[1200px] mx-auto p-6">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-xl font-bold m-0">纠错定位编辑器</h2>
        <Link to="/dict">
          <button className="px-4 py-1.5 rounded border border-blue-600 bg-white text-blue-600 text-sm cursor-pointer hover:bg-blue-50">
            管理错词库
          </button>
        </Link>
      </div>

      <div className="text-xs text-gray-500 mb-3">
        共 {Object.keys(errorMap).length} 个错词规则
        {checkCount > 0 && ` · 已检查 ${checkCount} 次`}
      </div>

      <div className="flex gap-4 items-start">
        <div className="flex-1 min-w-0 relative">
          {!editorReady && (
            <div
              className="absolute inset-0 flex items-center justify-center bg-white rounded border border-gray-200 z-10"
              style={{ height: 500 }}
            >
              <div className="flex flex-col items-center gap-2">
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-gray-400">加载编辑器中...</span>
              </div>
            </div>
          )}
          <div className={editorReady ? '' : 'invisible'}>
            <Editor
              tinymceScriptSrc="https://cdn.jsdelivr.net/npm/tinymce@7/tinymce.min.js"
              onInit={(_evt, editor) => {
                editorRef.current = editor
                setEditorReady(true)
              }}
              initialValue={`<p>用户<b>登</b>陆系统时<i>需</i>要输入验证码。</p>
<p>这是一个<span style="color:red">必须</span>快速处理的问题。</p>
<p>我们的<u>方</u>案包<em>含</em>了所有功能。</p>
<p>系统<strong>账户</strong>管理是<b>必</b>要的。</p>
<p>您的<b>😀</b>账户已激活❤️请查收。</p>
<p>✨🎉<i>登</i>陆<i>需</i>要双重验证👍🏽</p>
<p>caf\u00e9<u>必</u>须<em>登</em>陆🎈</p>
<p>e\u0301<strong>账</strong>户❤️‍🔥<b>需</b>要管理员权限</p>
<p>🎊<b>方</b>案包<em>含</em>所有目标🎯</p>
<p>𠀀𪚥㐀<i>需</i>要∑∫√<b>登</b>陆∞²³©®<em>必</em>须</p>`}
              init={{
                height: 500,
                language: 'zh_CN',
                toolbar:
                  'spellcheck clearspell | undo redo | bold italic underline | forecolor backcolor',
                menubar: false,
                plugins: '',
                setup: (editor: any) => {
                  apiRef.current = setupTinyMCESpellCheck(
                    editor,
                    () => getErrorMap(),
                    (list: ErrorTrayItem[]) => {
                      setErrorList(list)
                      setSelectedId(null)
                    },
                    (replacedId: string) =>
                      setErrorList((prev) => prev.filter((e) => e.errorId !== replacedId)),
                    (errorId: string) => handleSelectError(errorId)
                  )
                  editor.on('SpellCheckComplete', () => setCheckCount((c: number) => c + 1))
                },
                content_style: [
                  'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 15px; line-height: 1.6; padding: 12px; }',
                  '.spell-error { background-color: rgba(255,0,0,0.2); border-bottom: 2px dashed #f00; cursor: pointer; }',
                  '.spell-error.selected { background-color: rgba(0,200,0,0.2) !important; border-bottom: 2px solid #00c800 !important; }'
                ].join('\n')
              }}
            />
          </div>
        </div>

        <div className="w-[260px] shrink-0 border border-gray-200 rounded-lg bg-gray-50 max-h-[500px] overflow-y-auto flex flex-col">
          <div className="px-3.5 py-2.5 font-semibold text-sm border-b border-gray-200 bg-white rounded-t-lg">
            错误列表
            <span className="text-xs text-gray-400 ml-1.5">({errorList.length})</span>
          </div>

          {errorList.length === 0 && (
            <div className="p-6 text-center text-gray-300 text-xs">点击「纠错定位」查找错误</div>
          )}

          {[...errorList].reverse().map((item) => (
            <div
              key={item.errorId}
              className={`px-3.5 py-2.5 border-b border-gray-100 cursor-pointer transition-colors duration-150 ${selectedId === item.errorId ? 'bg-green-50' : ''}`}
              onClick={() => handleSelectError(item.errorId)}
            >
              <div className="mb-1.5">
                <span className="bg-red-100/50 border-b-2 border-red-500 border-dashed px-0.5 text-sm leading-relaxed">
                  {item.word}
                </span>
              </div>
              <div className="flex flex-wrap gap-1">
                {item.suggestions.map((s) => (
                  <button
                    key={s}
                    className="px-2.5 py-0.5 text-xs cursor-pointer rounded border border-blue-600 bg-white text-blue-600 transition-all duration-150 hover:bg-blue-50"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleReplace(item.errorId, s)
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
