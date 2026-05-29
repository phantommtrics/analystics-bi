import { Router } from 'express'
import { rolesRouter } from './roles.js'
import { groupsRouter } from './groups.js'
import { operatorsRouter } from './operators.js'

export const adminRouter = Router()

adminRouter.use('/roles', rolesRouter)
adminRouter.use('/groups', groupsRouter)
adminRouter.use('/operators', operatorsRouter)
