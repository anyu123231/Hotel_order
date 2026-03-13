const { useEffect: useEffectProfile, useState: useStateProfile } = React;
const {
  Card: CardProfile,
  List: ListProfile,
  Typography: TypographyProfile,
  Tag: TagProfile,
  Button: ButtonProfile,
  Tabs: TabsProfile,
  Input: InputProfile,
  Space: SpaceProfile,
  message: messageProfile
} = antd;

function ProfileView({ user, API_BASE, onBack, onUserUpdated }) {
  const [orders, setOrders] = useStateProfile([]);
  const [loading, setLoading] = useStateProfile(false);
  const [activeTab, setActiveTab] = useStateProfile('orders');
  const [expandedOrderId, setExpandedOrderId] = useStateProfile(null);
  const [orderItemsMap, setOrderItemsMap] = useStateProfile({});
  const [detailsLoadingId, setDetailsLoadingId] = useStateProfile(null);
  const [profileForm, setProfileForm] = useStateProfile({
    username: user.username,
    email: user.email,
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [savingProfile, setSavingProfile] = useStateProfile(false);

  const loadOrders = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await axios.get(API_BASE + '/api/user/orders', {
        params: { userId: user.id }
      });
      setOrders(res.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffectProfile(() => {
    loadOrders();
  }, [user?.id]);

  const statusConfig = {
    PENDING: { color: 'gold', text: '待处理' },
    PREPARING: { color: 'blue', text: '备货中' },
    SENT: { color: 'orange', text: '已送出' },
    DELIVERED: { color: 'green', text: '已送达' },
    CANCELLED: { color: 'red', text: '已取消' }
  };

  return (
    <CardProfile
      title="个人中心"
      bordered={false}
      style={{ borderRadius: 18, marginTop: 16, background: '#f9fafb' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <TypographyProfile.Title level={5} style={{ margin: 0 }}>
          欢迎您，{user.username}
        </TypographyProfile.Title>
        {onBack && (
          <ButtonProfile type="link" size="small" onClick={onBack}>
            返回点单
          </ButtonProfile>
        )}
      </div>

      <TabsProfile
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key)}
        items={[
          { key: 'orders', label: '我的订单' },
          { key: 'account', label: '账号设置' }
        ]}
      />

      {activeTab === 'orders' && (
        <ListProfile
          loading={loading}
          dataSource={orders}
          locale={{ emptyText: '暂无订单记录' }}
          renderItem={(order) => {
            const cfg = statusConfig[order.status] || {
              color: 'default',
              text: order.status
            };
            const expanded = expandedOrderId === order.id;
            const items = orderItemsMap[order.id] || [];
            return (
              <div style={{ marginBottom: 8 }}>
                <ListProfile.Item
                  actions={[
                    <ButtonProfile
                      key="toggle"
                      type="link"
                      size="small"
                      onClick={async () => {
                        if (expanded) {
                          setExpandedOrderId(null);
                          return;
                        }
                        setExpandedOrderId(order.id);
                        if (!orderItemsMap[order.id]) {
                          setDetailsLoadingId(order.id);
                          try {
                            const res = await axios.get(API_BASE + '/api/user/order-items', {
                              params: { userId: user.id, orderId: order.id }
                            });
                            setOrderItemsMap((prev) => ({
                              ...prev,
                              [order.id]: res.data || []
                            }));
                          } catch (e) {
                            console.error(e);
                          } finally {
                            setDetailsLoadingId(null);
                          }
                        }
                      }}
                    >
                      {expanded ? '收起 ∧' : '详情 ∨'}
                    </ButtonProfile>
                  ]}
                >
                  <ListProfile.Item.Meta
                    title={
                      <>
                        房间 {order.room_number}{' '}
                        <TagProfile color={cfg.color}>{cfg.text}</TagProfile>
                      </>
                    }
                    description={
                      <>
                        <div>
                          金额：￥{Number(order.total_price).toFixed(2)} · 下单时间：
                          {order.created_at}
                        </div>
                        {order.remark && <div>备注：{order.remark}</div>}
                      </>
                    }
                  />
                </ListProfile.Item>
                {expanded && (
                  <div
                    style={{
                      padding: '8px 16px 12px',
                      background: '#f4f4f5',
                      borderRadius: 12,
                      marginTop: -8,
                      marginBottom: 8
                    }}
                  >
                    {detailsLoadingId === order.id ? (
                      <TypographyProfile.Text type="secondary">
                        正在加载订单详情…
                      </TypographyProfile.Text>
                    ) : items.length === 0 ? (
                      <TypographyProfile.Text type="secondary">
                        暂无明细记录
                      </TypographyProfile.Text>
                    ) : (
                      <ul style={{ paddingLeft: 16, margin: 0 }}>
                        {items.map((it) => (
                          <li key={it.id} style={{ fontSize: 13, marginBottom: 4 }}>
                            {it.name} × {it.quantity}（￥
                            {Number(it.unit_price).toFixed(2)}）
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            );
          }}
        />
      )}

      {activeTab === 'account' && (
        <SpaceProfile direction="vertical" style={{ width: '100%' }} size="middle">
          <TypographyProfile.Text type="secondary">
            修改用户名、邮箱或密码。为安全起见，修改时需要输入当前密码。
          </TypographyProfile.Text>
          <InputProfile
            placeholder="用户名"
            value={profileForm.username}
            onChange={(e) =>
              setProfileForm((f) => ({
                ...f,
                username: e.target.value
              }))
            }
          />
          <InputProfile
            placeholder="邮箱"
            value={profileForm.email}
            onChange={(e) =>
              setProfileForm((f) => ({
                ...f,
                email: e.target.value
              }))
            }
          />
          <InputProfile.Password
            placeholder="当前密码（必填）"
            value={profileForm.currentPassword}
            onChange={(e) =>
              setProfileForm((f) => ({
                ...f,
                currentPassword: e.target.value
              }))
            }
          />
          <InputProfile.Password
            placeholder="新密码（如不修改可留空）"
            value={profileForm.newPassword}
            onChange={(e) =>
              setProfileForm((f) => ({
                ...f,
                newPassword: e.target.value
              }))
            }
          />
          <InputProfile.Password
            placeholder="确认新密码"
            value={profileForm.confirmPassword}
            onChange={(e) =>
              setProfileForm((f) => ({
                ...f,
                confirmPassword: e.target.value
              }))
            }
          />
          <ButtonProfile
            type="primary"
            loading={savingProfile}
            onClick={async () => {
              if (!profileForm.currentPassword) {
                messageProfile.warning('请填写当前密码');
                return;
              }
              if (
                profileForm.newPassword &&
                profileForm.newPassword !== profileForm.confirmPassword
              ) {
                messageProfile.warning('两次输入的新密码不一致');
                return;
              }
              setSavingProfile(true);
              try {
                const res = await axios.post(API_BASE + '/api/user/profile', {
                  userId: user.id,
                  username: profileForm.username,
                  email: profileForm.email,
                  currentPassword: profileForm.currentPassword,
                  newPassword: profileForm.newPassword || null
                });
                messageProfile.success('资料已更新');
                if (onUserUpdated) {
                  onUserUpdated({
                    id: user.id,
                    username: res.data.username,
                    email: res.data.email
                  });
                }
              } catch (e) {
                console.error(e);
                const msg =
                  (e.response && e.response.data && e.response.data.message) ||
                  '更新失败，请检查密码是否正确';
                messageProfile.error(msg);
              } finally {
                setSavingProfile(false);
              }
            }}
          >
            保存修改
          </ButtonProfile>
        </SpaceProfile>
      )}
    </CardProfile>
  );
}

