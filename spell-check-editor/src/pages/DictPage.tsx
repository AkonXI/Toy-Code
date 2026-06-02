import { useState } from 'react'
import { useErrorDict } from '../context/ErrorDictContext'
import { Link } from 'react-router-dom'

export default function DictPage() {
  const { dict, addEntry, updateEntry, removeEntry } = useErrorDict()
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState({ word: '', suggestions: '', level: 1 })
  const [showAdd, setShowAdd] = useState(false)

  function handleEdit(entry: { id: number; word: string; suggestions: string[]; level: number }) {
    setEditingId(entry.id)
    setForm({ word: entry.word, suggestions: entry.suggestions.join(', '), level: entry.level })
  }

  function handleSave(id: number) {
    const suggestions = form.suggestions
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    if (!form.word || suggestions.length === 0) return
    updateEntry(id, { word: form.word, suggestions, level: Number(form.level) })
    setEditingId(null)
  }

  function handleAdd() {
    const suggestions = form.suggestions
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    if (!form.word || suggestions.length === 0) return
    addEntry({ word: form.word, suggestions, level: Number(form.level) })
    setForm({ word: '', suggestions: '', level: 1 })
    setShowAdd(false)
  }

  const levelLabel = ['', '拼写错误', '建议修改', '疑似错误']

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">错词库管理</h2>
        <div className="flex gap-2">
          <button
            className="px-4 py-1.5 rounded border border-gray-300 bg-white text-sm cursor-pointer hover:bg-gray-50"
            onClick={() => setShowAdd(!showAdd)}
          >
            {showAdd ? '取消' : '+ 添加'}
          </button>
          <Link to="/">
            <button className="px-4 py-1.5 rounded bg-blue-600 text-white text-sm cursor-pointer hover:bg-blue-700">
              返回编辑器
            </button>
          </Link>
        </div>
      </div>

      {showAdd && (
        <div className="flex gap-2 p-4 mb-4 bg-gray-100 rounded-lg flex-wrap">
          <input
            className="flex-1 min-w-[150px] px-2.5 py-1.5 border border-gray-300 rounded text-sm"
            placeholder="错误词"
            value={form.word}
            onChange={(e) => setForm({ ...form, word: e.target.value })}
          />
          <input
            className="flex-1 min-w-[150px] px-2.5 py-1.5 border border-gray-300 rounded text-sm"
            placeholder="建议（多个用逗号分隔）"
            value={form.suggestions}
            onChange={(e) => setForm({ ...form, suggestions: e.target.value })}
          />
          <select
            className="px-2.5 py-1.5 border border-gray-300 rounded text-sm bg-white"
            value={form.level}
            onChange={(e) => setForm({ ...form, level: Number(e.target.value) })}
          >
            <option value={1}>拼写错误</option>
            <option value={2}>建议修改</option>
            <option value={3}>疑似错误</option>
          </select>
          <button
            className="px-4 py-1.5 rounded bg-blue-600 text-white text-sm cursor-pointer hover:bg-blue-700"
            onClick={handleAdd}
          >
            确认添加
          </button>
        </div>
      )}

      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="text-left px-3 py-2 border-b-2 border-gray-300 bg-gray-50 text-xs font-semibold text-gray-600">
              错误词
            </th>
            <th className="text-left px-3 py-2 border-b-2 border-gray-300 bg-gray-50 text-xs font-semibold text-gray-600">
              建议修改
            </th>
            <th className="text-left px-3 py-2 border-b-2 border-gray-300 bg-gray-50 text-xs font-semibold text-gray-600">
              级别
            </th>
            <th className="text-left px-3 py-2 border-b-2 border-gray-300 bg-gray-50 text-xs font-semibold text-gray-600">
              操作
            </th>
          </tr>
        </thead>
        <tbody>
          {dict.map((entry) => (
            <tr key={entry.id}>
              {editingId === entry.id ? (
                <>
                  <td className="px-3 py-2 border-b border-gray-200">
                    <input
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                      value={form.word}
                      onChange={(e) => setForm({ ...form, word: e.target.value })}
                    />
                  </td>
                  <td className="px-3 py-2 border-b border-gray-200">
                    <input
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                      value={form.suggestions}
                      onChange={(e) => setForm({ ...form, suggestions: e.target.value })}
                    />
                  </td>
                  <td className="px-3 py-2 border-b border-gray-200">
                    <select
                      className="px-2 py-1 border border-gray-300 rounded text-sm bg-white"
                      value={form.level}
                      onChange={(e) => setForm({ ...form, level: Number(e.target.value) })}
                    >
                      <option value={1}>拼写错误</option>
                      <option value={2}>建议修改</option>
                      <option value={3}>疑似错误</option>
                    </select>
                  </td>
                  <td className="px-3 py-2 border-b border-gray-200">
                    <button
                      className="px-2.5 py-1 rounded border border-gray-300 bg-white text-xs cursor-pointer mr-1 hover:bg-gray-50"
                      onClick={() => handleSave(entry.id)}
                    >
                      保存
                    </button>
                    <button
                      className="px-2.5 py-1 rounded border border-gray-300 bg-white text-xs cursor-pointer hover:bg-gray-50"
                      onClick={() => setEditingId(null)}
                    >
                      取消
                    </button>
                  </td>
                </>
              ) : (
                <>
                  <td className="px-3 py-2 border-b border-gray-200 text-sm">{entry.word}</td>
                  <td className="px-3 py-2 border-b border-gray-200 text-sm">
                    {entry.suggestions.join(', ')}
                  </td>
                  <td className="px-3 py-2 border-b border-gray-200 text-sm">
                    {levelLabel[entry.level]}
                  </td>
                  <td className="px-3 py-2 border-b border-gray-200">
                    <button
                      className="px-2.5 py-1 rounded border border-gray-300 bg-white text-xs cursor-pointer mr-1 hover:bg-gray-50"
                      onClick={() => handleEdit(entry)}
                    >
                      编辑
                    </button>
                    <button
                      className="px-2.5 py-1 rounded border border-red-300 bg-white text-xs cursor-pointer text-red-600 hover:bg-red-50"
                      onClick={() => removeEntry(entry.id)}
                    >
                      删除
                    </button>
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {dict.length === 0 && (
        <p className="text-center text-gray-400 mt-8 text-sm">暂无错词，请添加。</p>
      )}
    </div>
  )
}
