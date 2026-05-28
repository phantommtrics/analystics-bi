import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { PrismaClient, UserStatus, UserType } from '@prisma/client'

const prisma = new PrismaClient()

const modules = [
  'dashboard',
  'statements',
  'reports',
  'agents',
  'balance',
  'customers',
  'banks',
  'remittance',
  'aml',
  'dashboard-builder',
  'schedules',
  'access',
  'audit',
]

const actions = ['view', 'create', 'update', 'delete', 'approve']

async function main() {
  for (const moduleKey of modules) {
    for (const actionKey of actions) {
      await prisma.permission.upsert({
        where: { moduleKey_actionKey: { moduleKey, actionKey } },
        update: {},
        create: {
          moduleKey,
          actionKey,
          name: `${moduleKey}:${actionKey}`,
          description: `${actionKey} permission for ${moduleKey}`,
        },
      })
    }
  }

  const ownerRole = await prisma.role.upsert({
    where: { name: 'Owner' },
    update: {},
    create: { name: 'Owner', description: 'Full system access' },
  })

  const allPermissions = await prisma.permission.findMany({ select: { id: true } })
  for (const permission of allPermissions) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: ownerRole.id, permissionId: permission.id } },
      update: {},
      create: { roleId: ownerRole.id, permissionId: permission.id },
    })
  }

  const username = process.env.OWNER_USERNAME ?? 'owner'
  const email = process.env.OWNER_EMAIL ?? 'owner@bi.local'
  const password = process.env.OWNER_PASSWORD ?? 'ChangeMeNow123!'
  const passwordHash = await bcrypt.hash(password, 12)

  const owner = await prisma.user.upsert({
    where: { email },
    update: {
      username,
      passwordHash,
      userType: UserType.OWNER,
      status: UserStatus.ACTIVE,
    },
    create: {
      username,
      email,
      passwordHash,
      userType: UserType.OWNER,
      status: UserStatus.ACTIVE,
    },
  })

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: owner.id, roleId: ownerRole.id } },
    update: {},
    create: { userId: owner.id, roleId: ownerRole.id },
  })
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (error) => {
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })
