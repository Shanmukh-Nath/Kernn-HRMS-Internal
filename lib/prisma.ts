import {
  devicesCol,
  attendanceEventsCol,
  employeesCol,
  deviceSyncsCol,
  deviceRequestLogsCol,
  systemEventsCol,
  generateId,
} from './mongodb';

function normalizeDoc(doc: any) {
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return {
    ...rest,
    id: rest.id || _id?.toString(),
    createdAt: rest.createdAt ? new Date(rest.createdAt) : undefined,
    updatedAt: rest.updatedAt ? new Date(rest.updatedAt) : undefined,
    timestamp: rest.timestamp ? new Date(rest.timestamp) : undefined,
    startedAt: rest.startedAt ? new Date(rest.startedAt) : undefined,
    completedAt: rest.completedAt ? new Date(rest.completedAt) : undefined,
  };
}

function parseWhere(where: Record<string, any> = {}) {
  const mongoWhere: Record<string, any> = {};

  for (const [key, val] of Object.entries(where)) {
    if (val === undefined) continue;

    if (key === 'OR' && Array.isArray(val)) {
      mongoWhere.$or = val.map((item) => parseWhere(item));
      continue;
    }

    if (key === 'AND' && Array.isArray(val)) {
      mongoWhere.$and = val.map((item) => parseWhere(item));
      continue;
    }

    if (key === 'deviceId_deviceUserId' && typeof val === 'object') {
      mongoWhere.deviceId = val.deviceId;
      mongoWhere.deviceUserId = val.deviceUserId;
      continue;
    }

    if (key === 'deviceId_deviceUserId_timestamp_eventType' && typeof val === 'object') {
      mongoWhere.deviceId = val.deviceId;
      mongoWhere.deviceUserId = val.deviceUserId;
      mongoWhere.timestamp = val.timestamp;
      mongoWhere.eventType = val.eventType;
      continue;
    }

    if (typeof val === 'object' && val !== null && !(val instanceof Date)) {
      const cond: Record<string, any> = {};
      if ('contains' in val) {
        cond.$regex = new RegExp(val.contains, 'i');
      }
      if ('gte' in val) cond.$gte = val.gte;
      if ('lte' in val) cond.$lte = val.lte;
      if ('gt' in val) cond.$gt = val.gt;
      if ('lt' in val) cond.$lt = val.lt;
      if ('in' in val) cond.$in = val.in;
      if ('not' in val) cond.$ne = val.not;
      mongoWhere[key] = cond;
    } else {
      if (key === 'id') {
        mongoWhere.$or = [{ id: val }, { _id: val }];
      } else {
        mongoWhere[key] = val;
      }
    }
  }

  return mongoWhere;
}

function parseSort(orderBy: any): any {
  if (!orderBy) return { createdAt: -1 };
  const sort: Record<string, any> = {};
  if (Array.isArray(orderBy)) {
    for (const o of orderBy) {
      for (const [k, v] of Object.entries(o)) {
        sort[k] = v === 'asc' ? 1 : -1;
      }
    }
  } else {
    for (const [k, v] of Object.entries(orderBy)) {
      sort[k] = v === 'asc' ? 1 : -1;
    }
  }
  return sort;
}

export const prisma = {
  device: {
    findMany: async (args: any = {}) => {
      const col = await devicesCol();
      const where = parseWhere(args.where);
      const sort = parseSort(args.orderBy);
      const cursor = col.find(where).sort(sort as any);
      if (args.skip) cursor.skip(args.skip);
      if (args.take) cursor.limit(args.take);
      const docs = await cursor.toArray();

      if (args.include?._count) {
        const empCol = await employeesCol();
        const attCol = await attendanceEventsCol();
        return Promise.all(
          docs.map(async (doc) => {
            const d = normalizeDoc(doc);
            const empCount = await empCol.countDocuments({ deviceId: d.id });
            const attCount = await attCol.countDocuments({ deviceId: d.id });
            return {
              ...d,
              _count: { employees: empCount, attendance: attCount },
            };
          })
        );
      }

      return docs.map(normalizeDoc);
    },

    findUnique: async (args: any) => {
      const col = await devicesCol();
      const where = parseWhere(args.where);
      const doc = await col.findOne(where);
      return normalizeDoc(doc);
    },

    findFirst: async (args: any = {}) => {
      const col = await devicesCol();
      const where = parseWhere(args.where);
      const sort = parseSort(args.orderBy);
      const doc = await col.findOne(where, { sort: sort as any });
      return normalizeDoc(doc);
    },

    create: async (args: any) => {
      const col = await devicesCol();
      const id = args.data.id || generateId();
      const now = new Date();
      const doc = {
        ...args.data,
        id,
        createdAt: now,
        updatedAt: now,
      };
      await col.insertOne(doc);
      return normalizeDoc(doc);
    },

    update: async (args: any) => {
      const col = await devicesCol();
      const where = parseWhere(args.where);
      const updateData = { ...args.data, updatedAt: new Date() };
      await col.updateOne(where, { $set: updateData });
      const doc = await col.findOne(where);
      return normalizeDoc(doc);
    },

    upsert: async (args: any) => {
      const col = await devicesCol();
      const where = parseWhere(args.where);
      const existing = await col.findOne(where);
      if (existing) {
        if (args.update && Object.keys(args.update).length > 0) {
          await col.updateOne(where, { $set: { ...args.update, updatedAt: new Date() } });
        }
        const updated = await col.findOne(where);
        return normalizeDoc(updated);
      }
      const id = args.create.id || generateId();
      const doc = {
        ...args.create,
        id,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await col.insertOne(doc);
      return normalizeDoc(doc);
    },

    delete: async (args: any) => {
      const col = await devicesCol();
      const where = parseWhere(args.where);
      const doc = await col.findOne(where);
      await col.deleteOne(where);
      return normalizeDoc(doc);
    },

    count: async (args: any = {}) => {
      const col = await devicesCol();
      const where = parseWhere(args.where);
      return col.countDocuments(where);
    },
  },

  employee: {
    findMany: async (args: any = {}) => {
      const col = await employeesCol();
      const where = parseWhere(args.where);
      const sort = parseSort(args.orderBy);
      const cursor = col.find(where).sort(sort as any);
      if (args.skip) cursor.skip(args.skip);
      if (args.take) cursor.limit(args.take);
      const docs = await cursor.toArray();
      return docs.map(normalizeDoc);
    },

    findUnique: async (args: any) => {
      const col = await employeesCol();
      const where = parseWhere(args.where);
      const doc = await col.findOne(where);
      return normalizeDoc(doc);
    },

    findFirst: async (args: any = {}) => {
      const col = await employeesCol();
      const where = parseWhere(args.where);
      const sort = parseSort(args.orderBy);
      const doc = await col.findOne(where, { sort: sort as any });
      return normalizeDoc(doc);
    },

    create: async (args: any) => {
      const col = await employeesCol();
      const id = args.data.id || generateId();
      const now = new Date();
      const doc = {
        ...args.data,
        id,
        createdAt: now,
        updatedAt: now,
      };
      await col.insertOne(doc);
      return normalizeDoc(doc);
    },

    update: async (args: any) => {
      const col = await employeesCol();
      const where = parseWhere(args.where);
      await col.updateOne(where, { $set: { ...args.data, updatedAt: new Date() } });
      const doc = await col.findOne(where);
      return normalizeDoc(doc);
    },

    upsert: async (args: any) => {
      const col = await employeesCol();
      const where = parseWhere(args.where);
      const existing = await col.findOne(where);
      if (existing) {
        if (args.update && Object.keys(args.update).length > 0) {
          await col.updateOne(where, { $set: { ...args.update, updatedAt: new Date() } });
        }
        const updated = await col.findOne(where);
        return normalizeDoc(updated);
      }
      const id = args.create.id || generateId();
      const doc = {
        ...args.create,
        id,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await col.insertOne(doc);
      return normalizeDoc(doc);
    },

    count: async (args: any = {}) => {
      const col = await employeesCol();
      const where = parseWhere(args.where);
      return col.countDocuments(where);
    },
  },

  attendanceEvent: {
    findMany: async (args: any = {}) => {
      const col = await attendanceEventsCol();
      const where = parseWhere(args.where);
      const sort = parseSort(args.orderBy || { timestamp: -1 });
      const cursor = col.find(where).sort(sort as any);
      if (args.skip) cursor.skip(args.skip);
      if (args.take) cursor.limit(args.take);
      const docs = await cursor.toArray();

      if (args.include?.device || args.include?.employee) {
        const devCol = await devicesCol();
        const empCol = await employeesCol();
        const devices = await devCol.find({}).toArray();
        const employees = await empCol.find({}).toArray();
        const devMap = new Map(devices.map((d) => [d.id || d.deviceId, d]));
        const empMap = new Map(employees.map((e) => [e.id, e]));

        return docs.map((doc) => {
          const d = normalizeDoc(doc);
          return {
            ...d,
            device: devMap.get(d.deviceId) || { name: 'Device', deviceId: d.deviceId },
            employee: empMap.get(d.employeeId) || null,
          };
        });
      }

      return docs.map(normalizeDoc);
    },

    findFirst: async (args: any = {}) => {
      const col = await attendanceEventsCol();
      const where = parseWhere(args.where);
      const sort = parseSort(args.orderBy || { timestamp: -1 });
      const doc = await col.findOne(where, { sort: sort as any });
      if (!doc) return null;
      const d = normalizeDoc(doc);

      if (args.include?.device || args.include?.employee) {
        const devCol = await devicesCol();
        const empCol = await employeesCol();
        const dev = await devCol.findOne({ $or: [{ id: d.deviceId }, { deviceId: d.deviceId }] });
        const emp = d.employeeId ? await empCol.findOne({ id: d.employeeId }) : null;
        return {
          ...d,
          device: dev ? normalizeDoc(dev) : { name: 'Device' },
          employee: emp ? normalizeDoc(emp) : null,
        };
      }

      return d;
    },

    create: async (args: any) => {
      const col = await attendanceEventsCol();
      const id = args.data.id || generateId();
      const now = new Date();
      const doc = {
        ...args.data,
        id,
        createdAt: now,
      };
      await col.insertOne(doc);
      return normalizeDoc(doc);
    },

    upsert: async (args: any) => {
      const col = await attendanceEventsCol();
      const where = parseWhere(args.where);
      const existing = await col.findOne(where);
      if (existing) {
        if (args.update && Object.keys(args.update).length > 0) {
          await col.updateOne(where, { $set: args.update });
        }
        return normalizeDoc(existing);
      }
      const id = args.create.id || generateId();
      const doc = {
        ...args.create,
        id,
        createdAt: new Date(),
      };
      await col.insertOne(doc);
      return normalizeDoc(doc);
    },

    count: async (args: any = {}) => {
      const col = await attendanceEventsCol();
      const where = parseWhere(args.where);
      return col.countDocuments(where);
    },
  },

  deviceSync: {
    findMany: async (args: any = {}) => {
      const col = await deviceSyncsCol();
      const where = parseWhere(args.where);
      const sort = parseSort(args.orderBy || { startedAt: -1 });
      const cursor = col.find(where).sort(sort as any);
      if (args.skip) cursor.skip(args.skip);
      if (args.take) cursor.limit(args.take);
      const docs = await cursor.toArray();

      if (args.include?.device) {
        const devCol = await devicesCol();
        const devices = await devCol.find({}).toArray();
        const devMap = new Map(devices.map((d) => [d.id || d.deviceId, d]));
        return docs.map((doc) => {
          const d = normalizeDoc(doc);
          return {
            ...d,
            device: devMap.get(d.deviceId) || { name: 'Device' },
          };
        });
      }

      return docs.map(normalizeDoc);
    },

    findFirst: async (args: any = {}) => {
      const col = await deviceSyncsCol();
      const where = parseWhere(args.where);
      const sort = parseSort(args.orderBy || { startedAt: -1 });
      const doc = await col.findOne(where, { sort: sort as any });
      if (!doc) return null;
      const d = normalizeDoc(doc);

      if (args.include?.device) {
        const devCol = await devicesCol();
        const dev = await devCol.findOne({ $or: [{ id: d.deviceId }, { deviceId: d.deviceId }] });
        return {
          ...d,
          device: dev ? normalizeDoc(dev) : { name: 'Device' },
        };
      }

      return d;
    },

    create: async (args: any) => {
      const col = await deviceSyncsCol();
      const id = args.data.id || generateId();
      const doc = {
        ...args.data,
        id,
        startedAt: args.data.startedAt || new Date(),
      };
      await col.insertOne(doc);
      return normalizeDoc(doc);
    },

    update: async (args: any) => {
      const col = await deviceSyncsCol();
      const where = parseWhere(args.where);
      await col.updateOne(where, { $set: args.data });
      const doc = await col.findOne(where);
      return normalizeDoc(doc);
    },

    count: async (args: any = {}) => {
      const col = await deviceSyncsCol();
      const where = parseWhere(args.where);
      return col.countDocuments(where);
    },
  },

  deviceRequestLog: {
    findMany: async (args: any = {}) => {
      const col = await deviceRequestLogsCol();
      const where = parseWhere(args.where);
      const sort = parseSort(args.orderBy || { createdAt: -1 });
      const cursor = col.find(where).sort(sort as any);
      if (args.skip) cursor.skip(args.skip);
      if (args.take) cursor.limit(args.take);
      const docs = await cursor.toArray();

      if (args.include?.device) {
        const devCol = await devicesCol();
        const devices = await devCol.find({}).toArray();
        const devMap = new Map(devices.map((d) => [d.id || d.deviceId, d]));
        return docs.map((doc) => {
          const d = normalizeDoc(doc);
          return {
            ...d,
            device: devMap.get(d.deviceId) || { name: 'Device', deviceId: d.deviceId, ipAddress: '' },
          };
        });
      }

      return docs.map(normalizeDoc);
    },

    deleteMany: async (args: any = {}) => {
      const col = await deviceRequestLogsCol();
      const where = parseWhere(args.where);
      return col.deleteMany(where);
    },

    create: async (args: any) => {
      const col = await deviceRequestLogsCol();
      const id = args.data.id || generateId();
      const doc = {
        ...args.data,
        id,
        createdAt: args.data.createdAt || new Date(),
      };
      await col.insertOne(doc);
      return normalizeDoc(doc);
    },

    count: async (args: any = {}) => {
      const col = await deviceRequestLogsCol();
      const where = parseWhere(args.where);
      return col.countDocuments(where);
    },
  },

  systemEvent: {
    create: async (args: any) => {
      const col = await systemEventsCol();
      const id = args.data.id || generateId();
      const doc = {
        ...args.data,
        id,
        createdAt: new Date(),
      };
      await col.insertOne(doc);
      return normalizeDoc(doc);
    },
  },

  $disconnect: async () => {
    // MongoDB connection pool handled globally
  },
};
