import React from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { RequirePermission } from './auth/RequirePermission'
import { AppShell } from './components/layout/AppShell'
import { Roles } from './pages/admin/Roles'
import { UserGroups } from './pages/admin/UserGroups'
import { Operators } from './pages/admin/Operators'
import { DataSources } from './pages/admin/DataSources'
import { AgentNetwork } from './pages/AgentNetwork'
import { AmlAlerts } from './pages/AmlAlerts'
import { AuditLog } from './pages/AuditLog'
import { Banks } from './pages/Banks'
import { ChangePassword } from './pages/ChangePassword'
import { Customers } from './pages/Customers'
import { Dashboard } from './pages/Dashboard'
import { CustomDashboard } from './pages/CustomDashboard'
import { DashboardBuilder } from './pages/DashboardBuilder'
import { FinancialStatements } from './pages/FinancialStatements'
import { Remittance } from './pages/Remittance'
import { ReportBuilder } from './pages/ReportBuilder'
import { ReportCatalog } from './pages/ReportCatalog'
import { Schedules } from './pages/Schedules'
import { SystemBalance } from './pages/SystemBalance'
import { Login } from './pages/Login'

function ShellLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  )
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/change-password" element={<ChangePassword />} />
          <Route element={<ShellLayout />}>
            <Route
              path="/"
              element={
                <RequirePermission moduleKey="dashboard">
                  <Dashboard />
                </RequirePermission>
              }
            />
            <Route path="/dashboards/:id" element={<CustomDashboard />} />
            <Route
              path="/statements"
              element={
                <RequirePermission moduleKey="statements">
                  <FinancialStatements />
                </RequirePermission>
              }
            />
            <Route
              path="/reports"
              element={
                <RequirePermission moduleKey="reports">
                  <ReportCatalog />
                </RequirePermission>
              }
            />
            <Route
              path="/reports/builder"
              element={
                <RequirePermission moduleKey="report-builder">
                  <ReportBuilder />
                </RequirePermission>
              }
            />
            <Route
              path="/agents"
              element={
                <RequirePermission moduleKey="agents">
                  <AgentNetwork />
                </RequirePermission>
              }
            />
            <Route
              path="/balance"
              element={
                <RequirePermission moduleKey="balance">
                  <SystemBalance />
                </RequirePermission>
              }
            />
            <Route
              path="/customers"
              element={
                <RequirePermission moduleKey="customers">
                  <Customers />
                </RequirePermission>
              }
            />
            <Route
              path="/banks"
              element={
                <RequirePermission moduleKey="banks">
                  <Banks />
                </RequirePermission>
              }
            />
            <Route
              path="/remittance"
              element={
                <RequirePermission moduleKey="remittance">
                  <Remittance />
                </RequirePermission>
              }
            />
            <Route
              path="/aml"
              element={
                <RequirePermission moduleKey="aml">
                  <AmlAlerts />
                </RequirePermission>
              }
            />
            <Route
              path="/dashboard-builder"
              element={
                <RequirePermission moduleKey="dashboard-builder">
                  <DashboardBuilder />
                </RequirePermission>
              }
            />
            <Route
              path="/schedules"
              element={
                <RequirePermission moduleKey="schedules">
                  <Schedules />
                </RequirePermission>
              }
            />
            <Route path="/access" element={<Navigate to="/admin/system/operators" replace />} />
            <Route
              path="/admin/system/roles"
              element={
                <RequirePermission moduleKey="system-config-roles">
                  <Roles />
                </RequirePermission>
              }
            />
            <Route
              path="/admin/system/groups"
              element={
                <RequirePermission moduleKey="system-config-groups">
                  <UserGroups />
                </RequirePermission>
              }
            />
            <Route
              path="/admin/system/operators"
              element={
                <RequirePermission moduleKey="system-config-operators">
                  <Operators />
                </RequirePermission>
              }
            />
            <Route
              path="/admin/system/datasources"
              element={
                <RequirePermission moduleKey="system-config-datasources">
                  <DataSources />
                </RequirePermission>
              }
            />
            <Route
              path="/audit"
              element={
                <RequirePermission moduleKey="audit">
                  <AuditLog />
                </RequirePermission>
              }
            />
            <Route
              path="*"
              element={
                <div className="flex h-full items-center justify-center text-text-secondary">
                  <div className="text-center">
                    <i className="ti ti-tools mb-2 text-4xl"></i>
                    <p>Module under construction</p>
                  </div>
                </div>
              }
            />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
