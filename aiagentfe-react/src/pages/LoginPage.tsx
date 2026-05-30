import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Form, Input, Button, message } from 'antd'
import { PhoneOutlined, KeyOutlined } from '@ant-design/icons'

export default function LoginPage() {
  const navigate = useNavigate()
  const [form] = Form.useForm()
  const [captchaUrl, setCaptchaUrl] = useState(
    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="40"><rect width="100" height="40" fill="%23eee"/><text x="50" y="25" font-size="20" fill="%23999" text-anchor="middle">?</text></svg>'
  )
  const captchaKeyRef = useRef('')
  const captchaLoadedRef = useRef(false)

  useEffect(() => {
    return () => {
      if (captchaUrl && !captchaUrl.startsWith('data:')) {
        URL.revokeObjectURL(captchaUrl)
      }
    }
  }, [captchaUrl])

  const refreshCaptcha = async (phone: string) => {
    try {
      const response = await fetch('/api/captcha/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'image/png' },
        body: JSON.stringify({ phone })
      })
      const key = response.headers.get('Captcha-Key')
      if (key) captchaKeyRef.current = key
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      setCaptchaUrl((prev) => {
        if (!prev.startsWith('data:')) URL.revokeObjectURL(prev)
        return url
      })
    } catch (e) {
      console.error('获取验证码失败:', e)
    }
  }

  const handleCaptchaClick = () => {
    const phone = form.getFieldValue('phone')
    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
      message.warning('请先填写正确的手机号')
      return
    }
    refreshCaptcha(phone)
  }

  const handlePhoneBlur = () => {
    const phone = form.getFieldValue('phone')
    if (/^1[3-9]\d{9}$/.test(phone) && !captchaLoadedRef.current) {
      captchaLoadedRef.current = true
      refreshCaptcha(phone)
    }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: values.phone,
          captcha: values.captcha,
          key: captchaKeyRef.current
        })
      })
      if (!response.ok) {
        const data = await response.json()
        message.error(data.message || '登录失败')
        refreshCaptcha(values.phone)
        form.setFieldValue('captcha', '')
        return
      }
      const data = (await response.json()) as { token: string; username: string }
      localStorage.setItem('auth_token', data.token)
      localStorage.setItem('login_phone', values.phone)
      window.dispatchEvent(new Event('auth-change'))
      message.success('登录成功')
      navigate('/conversations')
    } catch (e: any) {
      if (e.errorFields) return
      console.error('登录失败:', e)
      message.error('登录失败，请重试')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#667eea] to-[#764ba2] p-5">
      <Card className="w-full max-w-[400px]">
        <div className="text-center mb-6">
          <h2 className="m-0 text-[#333] text-xl">简历优化助手</h2>
          <p className="mt-2 mb-0 text-[#666] text-sm">上传简历，使用AI智能润色</p>
        </div>
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            name="phone"
            rules={[
              { required: true, message: '请输入手机号' },
              { pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确' }
            ]}
          >
            <Input prefix={<PhoneOutlined />} placeholder="请输入手机号" onBlur={handlePhoneBlur} />
          </Form.Item>
          <Form.Item name="captcha" rules={[{ required: true, message: '请输入图形验证码' }]}>
            <div className="flex gap-2.5">
              <Input prefix={<KeyOutlined />} placeholder="请输入图形验证码" className="flex-1" />
              <img
                src={captchaUrl}
                alt="验证码"
                className="h-8 cursor-pointer rounded border border-[#d9d9d9]"
                onClick={handleCaptchaClick}
                onError={() => {
                  setCaptchaUrl(
                    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="40"><rect width="100" height="40" fill="%23eee"/><text x="50" y="25" font-size="20" fill="%23999" text-anchor="middle">?</text></svg>'
                  )
                }}
              />
            </div>
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              登录
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}
