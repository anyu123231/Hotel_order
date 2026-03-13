const { useState } = React;
const {
  Card,
  Input,
  Button,
  Typography,
  Tabs,
  Space,
  message
} = antd;

function AuthView({ onAuthed, API_BASE }) {
  const [authMode, setAuthMode] = useState('login');
  const [loginType, setLoginType] = useState('password'); // password | code
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [code, setCode] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);

  const sendCode = async () => {
    const purpose = authMode === 'register' ? 'register' : 'login';
    if (authMode === 'login' && loginType !== 'code') {
      message.warning('请选择“验证码登录”后再获取验证码');
      return;
    }
    if (!email) {
      message.warning('请先输入邮箱');
      return;
    }
    setSending(true);
    try {
      await axios.post(API_BASE + '/api/auth/send-code', {
        email,
        purpose
      });
      message.success('验证码已发送，请查收邮箱');
    } catch (e) {
      console.error(e);
      const msg = e?.response?.data?.message || '发送验证码失败，请稍后重试';
      message.error(msg);
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = async () => {
    if (!email) {
      message.warning('请填写邮箱');
      return;
    }

    if (authMode === 'register') {
      if (!password || !code || !username || password !== passwordConfirm) {
        message.warning('请填写用户名、密码并输入正确的验证码');
        return;
      }
    } else if (authMode === 'login') {
      if (loginType === 'password' && !password) {
        message.warning('请输入密码');
        return;
      }
      if (loginType === 'code' && !code) {
        message.warning('请输入邮箱验证码');
        return;
      }
    }

    setLoading(true);
    try {
      if (authMode === 'register') {
        const res = await axios.post(API_BASE + '/api/auth/register', {
          username,
          email,
          password,
          code
        });
        const user = { id: res.data.id, username: res.data.username, email: res.data.email };
        onAuthed(user);
        message.success('注册并登录成功');
      } else if (authMode === 'login') {
        if (loginType === 'password') {
          const res = await axios.post(API_BASE + '/api/auth/login', {
            email,
            password,
            loginType: 'password'
          });
          const user = { id: res.data.id, username: res.data.username, email: res.data.email };
          onAuthed(user);
          message.success('登录成功');
        } else if (loginType === 'code') {
          const res = await axios.post(API_BASE + '/api/auth/login', {
            email,
            code,
            loginType: 'code'
          });
          const user = { id: res.data.id, username: res.data.username, email: res.data.email };
          onAuthed(user);
          message.success('登录成功');
        }
      }
    } catch (e) {
      console.error(e);
      const msg =
        (e && e.response && e.response.data && e.response.data.message) ||
        (authMode === 'login' ? '登录失败，请稍后重试' : '注册失败，请稍后重试');
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card
      bordered={false}
      style={{
        borderRadius: 18,
        maxWidth: 420,
        margin: '0 auto',
        boxShadow: '0 16px 40px rgba(15,23,42,0.12)'
      }}
    >
      <Tabs
        activeKey={authMode}
        onChange={(key) => {
          setAuthMode(key);
          setCode('');
          setLoginType('password');
        }}
        items={[
          { key: 'login', label: '登录' },
          { key: 'register', label: '注册' }
        ]}
        centered
      />
      <Space direction="vertical" style={{ width: '100%', marginTop: 8 }} size="middle">
        {authMode === 'register' && (
          <Input
            size="large"
            placeholder="用户名"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        )}
        <Input
          size="large"
          placeholder={authMode === 'login' && loginType === 'password' ? '邮箱或用户名' : '邮箱'}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        {authMode === 'login' && (
          <>
            <Space size="small">
              <Button
                size="small"
                type={loginType === 'password' ? 'primary' : 'default'}
                onClick={() => setLoginType('password')}
              >
                密码登录
              </Button>
              <Button
                size="small"
                type={loginType === 'code' ? 'primary' : 'default'}
                onClick={() => setLoginType('code')}
              >
                验证码登录
              </Button>
            </Space>
            {loginType === 'password' && (
              <Input.Password
                size="large"
                placeholder="密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            )}
            {loginType === 'code' && (
              <Space.Compact style={{ width: '100%' }}>
                <Input
                  size="large"
                  placeholder="邮箱验证码"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
                <Button size="large" onClick={sendCode} loading={sending}>
                  获取验证码
                </Button>
              </Space.Compact>
            )}
          </>
        )}
        {authMode === 'register' && (
          <>
            <Input.Password
              size="large"
              placeholder="密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Input.Password
              size="large"
              placeholder="确认密码"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
            />
            <Space.Compact style={{ width: '100%' }}>
              <Input
                size="large"
                placeholder="邮箱验证码"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
              <Button size="large" onClick={sendCode} loading={sending}>
                获取验证码
              </Button>
            </Space.Compact>
          </>
        )}
        <Button type="primary" size="large" block onClick={handleSubmit} loading={loading}>
          {authMode === 'login' ? '登录' : '注册并登录'}
        </Button>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          登录后即可为当前房间提交餐饮和客房服务订单。此账号仅用于本酒店内部使用。
        </Typography.Text>
      </Space>
    </Card>
  );
}

