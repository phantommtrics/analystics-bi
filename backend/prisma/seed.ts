import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { PrismaClient, UserStatus, UserType } from '@prisma/client'
import { MODULES, actionsForModule } from '../src/auth/permissions.js'

const prisma = new PrismaClient()

async function main() {
  // Remove legacy permission keys from prior seed
  await prisma.rolePermission.deleteMany({
    where: {
      permission: {
        actionKey: { in: ['create', 'update', 'approve'] },
      },
    },
  })
  await prisma.permission.deleteMany({
    where: {
      actionKey: { in: ['create', 'update', 'approve'] },
    },
  })

  await prisma.rolePermission.deleteMany({
    where: { permission: { moduleKey: 'access' } },
  })
  await prisma.permission.deleteMany({
    where: { moduleKey: 'access' },
  })

  await prisma.rolePermission.deleteMany({
    where: {
      permission: { moduleKey: { in: ['system-config', 'access'] } },
    },
  })
  await prisma.permission.deleteMany({
    where: { moduleKey: { in: ['system-config', 'access'] } },
  })

  for (const moduleKey of MODULES) {
    const allowed = actionsForModule(moduleKey)
    await prisma.rolePermission.deleteMany({
      where: {
        permission: {
          moduleKey,
          actionKey: { notIn: [...allowed] },
        },
      },
    })
    await prisma.permission.deleteMany({
      where: {
        moduleKey,
        actionKey: { notIn: [...allowed] },
      },
    })
  }

  for (const moduleKey of MODULES) {
    for (const actionKey of actionsForModule(moduleKey)) {
      await prisma.permission.upsert({
        where: { moduleKey_actionKey: { moduleKey, actionKey } },
        update: {
          name: `${moduleKey}:${actionKey}`,
          description: `${actionKey} permission for ${moduleKey}`,
        },
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
      mustChangePassword: false,
    },
    create: {
      username,
      email,
      passwordHash,
      userType: UserType.OWNER,
      status: UserStatus.ACTIVE,
      mustChangePassword: false,
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
