import { NavLink, Outlet } from 'react-router-dom'

const linkStyle = (active: boolean): React.CSSProperties => ({
  padding: '8px 10px', borderRadius: 8,
  background: active ? '#111827' : 'transparent',
  color: active ? '#fff' : '#374151', textDecoration: 'none', fontSize: 13,
})

export default function Layout(): React.ReactElement {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'ui-sans-system' }}>
      <nav style={{ width: 200, borderRight: '1px solid #e5e7eb', padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ fontWeight: 700, padding: '6px 4px' }}>openstage</div>
        <NavLink to="/" style={({ isActive }) => linkStyle(isActive)}>聊天</NavLink>
        <NavLink to="/characters" style={({ isActive }) => linkStyle(isActive)}>角色</NavLink>
        <NavLink to="/worldbook" style={({ isActive }) => linkStyle(isActive)}>世界书</NavLink>
        <NavLink to="/inspector" style={({ isActive }) => linkStyle(isActive)}>Inspector</NavLink>
        <NavLink to="/converter" style={({ isActive }) => linkStyle(isActive)}>卡片转换</NavLink>
        <NavLink to="/settings" style={({ isActive }) => linkStyle(isActive)}>设置</NavLink>
        <div style={{ marginTop: 'auto', fontSize: 11, color: '#9ca3af' }}>clean-room · MIT</div>
      </nav>
      <main style={{ flex: 1, background: '#f9fafb' }}><Outlet /></main>
    </div>
  )
}
