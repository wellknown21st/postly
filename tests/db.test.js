const prisma = require('../src/config/database');

describe('Database Integration', () => {
  it('should connect and perform basic CRUD operations', async () => {
    // Create
    const user = await prisma.user.create({
      data: {
        email: 'dbtest@example.com',
        username: 'dbuser',
        passwordHash: 'hashedpwd'
      }
    });
    expect(user.id).toBeDefined();

    // Read
    const fetched = await prisma.user.findUnique({ where: { id: user.id } });
    expect(fetched.email).toBe('dbtest@example.com');

    // Update
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { name: 'DB Test Name' }
    });
    expect(updated.name).toBe('DB Test Name');

    // Delete
    await prisma.user.delete({ where: { id: user.id } });
    const checkDeleted = await prisma.user.findUnique({ where: { id: user.id } });
    expect(checkDeleted).toBeNull();
  });
});
