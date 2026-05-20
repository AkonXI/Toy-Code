import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, message } from 'antd'
import { LogoutOutlined } from '@ant-design/icons'
import { useResumeStore } from '@/stores/resume'
import { logout } from '@/api'

export default function AppHeader() {
  const navigate = useNavigate()
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
      <div
        className="text-base font-semibold text-[#1677ff] cursor-pointer"
        onClick={() => navigate('/conversations')}
      >
        简历优化助手
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
