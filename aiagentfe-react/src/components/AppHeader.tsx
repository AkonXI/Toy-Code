import { useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Button, message } from 'antd'
import { LogoutOutlined } from '@ant-design/icons'
import { useResumeStore } from '@/stores/resume'
import { logout } from '@/api'

export default function AppHeader() {
  const navigate = useNavigate()
  const location = useLocation()
  const userInfo = useResumeStore((s) => s.userInfo)
  const fetchUserProfile = useResumeStore((s) => s.fetchUserProfile)

  useEffect(() => {
    fetchUserProfile()
  }, [fetchUserProfile])

  const handleLogout = async () => {
    try {
      await logout()
    } catch {
      /* empty */
    }
    localStorage.removeItem('auth_token')
    localStorage.removeItem('login_phone')
    window.dispatchEvent(new Event('auth-change'))
    message.success('已退出登录')
    navigate('/')
  }

  return (
    <header className="fixed top-0 left-0 right-0 h-[50px] bg-white border-b border-[#e5e5e5] flex items-center justify-between px-5 z-[1000] shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
      <div className="flex items-center gap-6">
        <span
          className="text-base font-semibold text-[#1677ff] cursor-pointer"
          onClick={() => navigate('/conversations')}
        >
          简历优化助手
        </span>
        <nav className="flex gap-4">
          <span
            className={`text-sm cursor-pointer px-2 py-0.5 rounded transition-all ${
              location.pathname === '/conversations'
                ? 'text-[#1677ff] font-medium'
                : 'text-[#666] hover:text-[#1677ff] hover:bg-[#f0f7ff]'
            }`}
            onClick={() => navigate('/conversations')}
          >
            会话
          </span>
          <span
            className={`text-sm cursor-pointer px-2 py-0.5 rounded transition-all ${
              location.pathname === '/documents'
                ? 'text-[#1677ff] font-medium'
                : 'text-[#666] hover:text-[#1677ff] hover:bg-[#f0f7ff]'
            }`}
            onClick={() => navigate('/documents')}
          >
            知识库
          </span>
        </nav>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-[13px] text-[#666]">{userInfo?.phone || ''}</span>
        <Button type="primary" danger size="small" icon={<LogoutOutlined />} onClick={handleLogout}>
          退出登录
        </Button>
      </div>
    </header>
  )
}
