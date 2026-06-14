import { Router } from 'express'
import { rolesRouter } from './roles.js'
import { groupsRouter } from './groups.js'
import { operatorsRouter } from './operators.js'
import { datasourcesRouter } from './datasources.js'
import { organizationsRouter } from './organizations.js'

export const adminRouter = Router()

adminRouter.use('/roles', rolesRouter)
adminRouter.use('/groups', groupsRouter)
adminRouter.use('/operators', operatorsRouter)
adminRouter.use('/datasources', datasourcesRouter)
adminRouter.use('/organizations', organizationsRouter)
