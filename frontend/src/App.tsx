import { Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './components/AppLayout'
import DataManagement from './pages/DataManagement'
import CaseCreate from './pages/CaseCreate'
import CaseReview from './pages/CaseReview'
import PlanComparison from './pages/PlanComparison'
import RulesManagement from './pages/RulesManagement'
import AIConfig from './pages/AIConfig'

function App() {
  return (
    <Routes>
      <Route path="/" element={<AppLayout />}>
        <Route index element={<Navigate to="/data" replace />} />
        <Route path="data" element={<DataManagement />} />
        <Route path="cases/new" element={<CaseCreate />} />
        <Route path="cases/:id" element={<CaseReview />} />
        <Route path="cases/:id/plans" element={<PlanComparison />} />
        <Route path="rules" element={<RulesManagement />} />
        <Route path="config" element={<AIConfig />} />
      </Route>
    </Routes>
  )
}

export default App
