const {
  Layout: LayoutOrder,
  Typography: TypographyOrder,
  Space: SpaceOrder,
  Input: InputOrder,
  Divider: DividerOrder,
  Card: CardOrder,
  Row: RowOrder,
  Col: ColOrder,
  Tag: TagOrder,
  Image: ImageOrder,
  List: ListOrder,
  Button: ButtonOrder,
  Modal: ModalOrder,
  Drawer: DrawerOrder,
  message: messageOrder
} = antd;

function OrderView({ user, API_BASE, initialRoom }) {
  const { useEffect, useState, useMemo } = React;
  const [items, setItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [cart, setCart] = useState({});
  const [roomNumber, setRoomNumber] = useState(initialRoom || '');
  const [guestName, setGuestName] = useState(user?.username || '');
  const [remark, setRemark] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [activeCategory, setActiveCategory] = useState(null);
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [formRoom, setFormRoom] = useState(initialRoom || '');
  const [formGuest, setFormGuest] = useState(user?.username || '');
  const [formRemark, setFormRemark] = useState('');
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false);

  const loadItems = async () => {
    setLoadingItems(true);
    try {
      const res = await axios.get(API_BASE + '/api/items');
      setItems(res.data || []);
    } catch (e) {
      console.error(e);
      messageOrder.error('加载商品失败，请稍后重试');
    } finally {
      setLoadingItems(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, []);

  const groupedItems = useMemo(() => {
    const groups = {};
    items.forEach((item) => {
      if (!groups[item.category]) {
        groups[item.category] = [];
      }
      groups[item.category].push(item);
    });
    return groups;
  }, [items]);

  const cartList = useMemo(() => Object.values(cart), [cart]);

  const totalPrice = useMemo(
    () => cartList.reduce((sum, c) => sum + c.price * c.quantity, 0),
    [cartList]
  );

  const handleAddToCart = (item) => {
    setCart((prev) => {
      const existing = prev[item.id];
      const quantity = existing ? existing.quantity + 1 : 1;
      return {
        ...prev,
        [item.id]: { ...item, quantity }
      };
    });
  };

  const handleDecrease = (id) => {
    setCart((prev) => {
      const current = prev[id];
      if (!current) return prev;
      if (current.quantity <= 1) {
        const { [id]: _, ...rest } = prev;
        return rest;
      }
      return {
        ...prev,
        [id]: { ...current, quantity: current.quantity - 1 }
      };
    });
  };

  const handleOpenOrderModal = () => {
    if (!user) {
      messageOrder.warning('请先登录后再下单');
      return;
    }
    if (cartList.length === 0) {
      messageOrder.warning('请先选择商品或服务');
      return;
    }
    setFormRoom(roomNumber || '');
    setFormGuest(guestName || user.username);
    setFormRemark(remark || '');
    setOrderModalOpen(true);
  };

  const handleConfirmOrder = async () => {
    if (!formRoom) {
      messageOrder.warning('请填写房间号');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        roomNumber: formRoom,
        guestName: formGuest || user.username,
        remark: formRemark || null,
        userId: user.id,
        items: cartList.map((c) => ({
          id: c.id,
          quantity: c.quantity
        }))
      };
      const res = await axios.post(API_BASE + '/api/orders', payload);
      messageOrder.success('下单成功，订单号：' + res.data.orderId);
      setCart({});
      setRemark('');
      setOrderModalOpen(false);
    } catch (e) {
      console.error(e);
      messageOrder.error('下单失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="page-shell">
        <div className="hero">
          <div className="hero-overlay"></div>
          <div className="hero-content">
            <div>
              <div className="hero-badge">
                <span className="hero-badge-dot" />
                24H 房内服务 · 一键下单
              </div>
              <div style={{ marginTop: 12 }}>
                <div className="hero-title">Room Service</div>
                <div className="hero-subtitle">
                  {user ? `欢迎您，${user.username}` : '专属您的客房餐饮与服务管家'}
                </div>
              </div>
            </div>
            <div className="hero-illustration">
              <div style={{ textAlign: 'center', lineHeight: 1.4 }}>
                <div>ORDER</div>
                <div style={{ fontSize: 13, opacity: 0.9 }}>Room {roomNumber || '--'}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="content-inner">
          <SpaceOrder direction="vertical" style={{ width: '100%' }} size="large">
            <DividerOrder orientation="left">可选商品 / 服务</DividerOrder>

            {loadingItems ? (
              <TypographyOrder.Text>正在加载商品…</TypographyOrder.Text>
            ) : (
              <RowOrder gutter={[16, 16]}>
                <ColOrder xs={24} md={5}>
                  <CardOrder
                    size="small"
                    bordered={false}
                    style={{ borderRadius: 16, background: '#f9fafb' }}
                  >
                    <TypographyOrder.Text strong>分类导航</TypographyOrder.Text>
                    <SpaceOrder direction="vertical" style={{ width: '100%', marginTop: 12 }}>
                      {Object.keys(groupedItems).map((category) => (
                        <ButtonOrder
                          key={category}
                          type={activeCategory === category ? 'primary' : 'text'}
                          block
                          onClick={() => setActiveCategory(category)}
                          style={{ justifyContent: 'flex-start' }}
                        >
                          {category}
                        </ButtonOrder>
                      ))}
                      {Object.keys(groupedItems).length > 1 && (
                        <ButtonOrder
                          type={!activeCategory ? 'primary' : 'text'}
                          block
                          onClick={() => setActiveCategory(null)}
                          style={{ justifyContent: 'flex-start' }}
                        >
                          全部
                        </ButtonOrder>
                      )}
                    </SpaceOrder>
                  </CardOrder>
                </ColOrder>
                <ColOrder xs={24} md={19}>
                  {Object.keys(groupedItems)
                    .filter((category) => !activeCategory || activeCategory === category)
                    .map((category) => (
                      <div key={category}>
                        <div className="category-title">
                          <SpaceOrder>
                            <TypographyOrder.Text strong>{category}</TypographyOrder.Text>
                            <TagOrder color="blue" bordered={false}>
                              精选
                            </TagOrder>
                          </SpaceOrder>
                        </div>
                        <RowOrder gutter={[16, 16]} className="item-grid">
                          {groupedItems[category].map((item) => {
                            const inCart = cart[item.id];
                            const hasImage = !!item.image_url;
                            return (
                              <ColOrder xs={24} sm={12} md={8} key={item.id}>
                                <CardOrder
                                  hoverable
                                  size="small"
                                  style={{ borderRadius: 16, overflow: 'hidden' }}
                                  cover={
                                    hasImage ? (
                                      <ImageOrder
                                        alt={item.name}
                                        src={item.image_url}
                                        height={140}
                                        style={{ objectFit: 'cover' }}
                                        preview={false}
                                      />
                                    ) : (
                                      <div
                                        style={{
                                          height: 140,
                                          background:
                                            'radial-gradient(circle at 30% 20%, #eab308, transparent 55%), radial-gradient(circle at 70% 80%, #f97316, transparent 55%)'
                                        }}
                                      />
                                    )
                                  }
                                  actions={[
                                    <SpaceOrder key="actions">
                                      {inCart && (
                                        <>
                                          <ButtonOrder
                                            size="small"
                                            shape="circle"
                                            onClick={() => handleDecrease(item.id)}
                                          >
                                            -
                                          </ButtonOrder>
                                          <span>{inCart.quantity}</span>
                                        </>
                                      )}
                                      <ButtonOrder
                                        type="primary"
                                        size="small"
                                        onClick={() => handleAddToCart(item)}
                                      >
                                        加入
                                      </ButtonOrder>
                                    </SpaceOrder>
                                  ]}
                                >
                                  <CardOrder.Meta
                                    title={
                                      <SpaceOrder direction="vertical" size={4}>
                                        <TypographyOrder.Text strong>
                                          {item.name}
                                        </TypographyOrder.Text>
                                        <TypographyOrder.Text type="danger" strong>
                                          ￥{Number(item.price).toFixed(2)}
                                        </TypographyOrder.Text>
                                      </SpaceOrder>
                                    }
                                    description={
                                      item.description || (
                                        <TypographyOrder.Text type="secondary">
                                          酒店精心为您准备的客房服务
                                        </TypographyOrder.Text>
                                      )
                                    }
                                  />
                                </CardOrder>
                              </ColOrder>
                            );
                          })}
                        </RowOrder>
                      </div>
                    ))}
                </ColOrder>
              </RowOrder>
            )}

            <DividerOrder orientation="left">已选项目</DividerOrder>

            {cartList.length === 0 ? (
              <TypographyOrder.Text type="secondary">暂未选择任何项目</TypographyOrder.Text>
            ) : (
              <ListOrder
                size="small"
                dataSource={cartList}
                renderItem={(c) => (
                  <ListOrder.Item
                    actions={[
                      <SpaceOrder key="actions">
                        <ButtonOrder size="small" onClick={() => handleDecrease(c.id)}>
                          -
                        </ButtonOrder>
                        <span>{c.quantity}</span>
                        <ButtonOrder
                          size="small"
                          type="primary"
                          onClick={() => handleAddToCart(c)}
                        >
                          +
                        </ButtonOrder>
                      </SpaceOrder>
                    ]}
                  >
                    <ListOrder.Item.Meta
                      title={
                        <SpaceOrder>
                          <TypographyOrder.Text>{c.name}</TypographyOrder.Text>
                          <TypographyOrder.Text type="secondary" style={{ fontSize: 12 }}>
                            × {c.quantity}
                          </TypographyOrder.Text>
                        </SpaceOrder>
                      }
                      description={
                        '单价 ￥' +
                        Number(c.price).toFixed(2) +
                        ' · 小计 ￥' +
                        (c.price * c.quantity).toFixed(2)
                      }
                    />
                  </ListOrder.Item>
                )}
              />
            )}
          </SpaceOrder>
        </div>
      </div>

      <div className="cart-bar">
        <div className="cart-bar-inner">
          <SpaceOrder
            align="center"
            style={{
              width: '100%',
              justifyContent: 'space-between'
            }}
          >
            <SpaceOrder direction="vertical" size={2}>
              <ButtonOrder
                type="text"
                size="small"
                onClick={() => setCartDrawerOpen(true)}
                disabled={cartList.length === 0}
                style={{ padding: 0, color: '#e5e7eb' }}
              >
                购物车（{cartList.length}）
              </ButtonOrder>
              <TypographyOrder.Text style={{ color: '#e5e7eb', fontSize: 12 }}>
                当前合计
              </TypographyOrder.Text>
              <TypographyOrder.Title
                level={4}
                style={{ margin: 0, color: '#f97316', letterSpacing: 1 }}
              >
                ￥{totalPrice.toFixed(2)}
              </TypographyOrder.Title>
            </SpaceOrder>
            <ButtonOrder
              type="primary"
              size="large"
              shape="round"
              onClick={handleOpenOrderModal}
              loading={submitting}
              disabled={cartList.length === 0}
              style={{
                minWidth: 160,
                boxShadow: '0 12px 30px rgba(59, 130, 246, 0.8)'
              }}
            >
              {cartList.length === 0 ? '请选择项目' : '提交订单'}
            </ButtonOrder>
          </SpaceOrder>
        </div>
      </div>

      <DrawerOrder
        title="已选商品"
        placement="bottom"
        open={cartDrawerOpen}
        onClose={() => setCartDrawerOpen(false)}
        height={260}
      >
        {cartList.length === 0 ? (
          <TypographyOrder.Text type="secondary">购物车为空</TypographyOrder.Text>
        ) : (
          <ListOrder
            size="small"
            dataSource={cartList}
            renderItem={(c) => (
              <ListOrder.Item
                actions={[
                  <SpaceOrder key="actions">
                    <ButtonOrder size="small" onClick={() => handleDecrease(c.id)}>
                      -
                    </ButtonOrder>
                    <span>{c.quantity}</span>
                    <ButtonOrder size="small" type="primary" onClick={() => handleAddToCart(c)}>
                      +
                    </ButtonOrder>
                  </SpaceOrder>
                ]}
              >
                <ListOrder.Item.Meta
                  title={c.name}
                  description={
                    '单价 ￥' +
                    Number(c.price).toFixed(2) +
                    ' · 小计 ￥' +
                    (c.price * c.quantity).toFixed(2)
                  }
                />
              </ListOrder.Item>
            )}
          />
        )}
      </DrawerOrder>

      <ModalOrder
        title="填写房间信息"
        open={orderModalOpen}
        onCancel={() => !submitting && setOrderModalOpen(false)}
        onOk={handleConfirmOrder}
        confirmLoading={submitting}
        okText="确认下单"
        cancelText="取消"
      >
        <SpaceOrder direction="vertical" style={{ width: '100%' }} size="middle">
          <InputOrder
            placeholder="房间号（必填）"
            value={formRoom}
            onChange={(e) => setFormRoom(e.target.value)}
          />
          <InputOrder
            placeholder="客人姓名（可选）"
            value={formGuest}
            onChange={(e) => setFormGuest(e.target.value)}
          />
          <InputOrder.TextArea
            placeholder="备注（例如：请 10 分钟后送、不要辣）"
            rows={3}
            value={formRemark}
            onChange={(e) => setFormRemark(e.target.value)}
          />
        </SpaceOrder>
      </ModalOrder>
    </>
  );
}

