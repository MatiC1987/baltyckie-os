import { z } from 'zod';
import { 
  insertOwnerSchema,
  owners,
  insertApartmentSchema, 
  apartments, 
  insertReservationSchema, 
  reservations,
  insertLeaseSchema,
  leases,
  insertExpenseSchema,
  expenses,
  insertAccountSchema,
  accounts,
  insertAccountSnapshotSchema,
  accountSnapshots,
  insertEmployeeSchema,
  employees,
  insertMedicalExamSchema,
  medicalExams,
  insertOwnerPaymentSchema,
  ownerPayments,
  insertBlockadeSchema,
  blockades
} from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  owners: {
    list: {
      method: 'GET' as const,
      path: '/api/owners',
      responses: {
        200: z.array(z.custom<typeof owners.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/owners/:id',
      responses: {
        200: z.custom<typeof owners.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/owners',
      input: insertOwnerSchema,
      responses: {
        201: z.custom<typeof owners.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/owners/:id',
      input: insertOwnerSchema.partial(),
      responses: {
        200: z.custom<typeof owners.$inferSelect>(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/owners/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },
  apartments: {
    list: {
      method: 'GET' as const,
      path: '/api/apartments',
      responses: {
        200: z.array(z.custom<typeof apartments.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/apartments/:id',
      responses: {
        200: z.custom<typeof apartments.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/apartments',
      input: insertApartmentSchema,
      responses: {
        201: z.custom<typeof apartments.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/apartments/:id',
      input: insertApartmentSchema.partial(),
      responses: {
        200: z.custom<typeof apartments.$inferSelect>(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/apartments/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },
  reservations: {
    list: {
      method: 'GET' as const,
      path: '/api/reservations',
      input: z.object({
        apartmentId: z.coerce.number().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof reservations.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/reservations',
      input: insertReservationSchema,
      responses: {
        201: z.custom<typeof reservations.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/reservations/:id',
      input: insertReservationSchema.partial(),
      responses: {
        200: z.custom<typeof reservations.$inferSelect>(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/reservations/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },
  leases: {
    list: {
      method: 'GET' as const,
      path: '/api/leases',
      input: z.object({
        apartmentId: z.coerce.number().optional(),
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof leases.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/leases',
      input: insertLeaseSchema,
      responses: {
        201: z.custom<typeof leases.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/leases/:id',
      input: insertLeaseSchema.partial(),
      responses: {
        200: z.custom<typeof leases.$inferSelect>(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
  },
  expenses: {
    list: {
      method: 'GET' as const,
      path: '/api/expenses',
      input: z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof expenses.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/expenses',
      input: insertExpenseSchema,
      responses: {
        201: z.custom<typeof expenses.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/expenses/:id',
      input: insertExpenseSchema.partial(),
      responses: {
        200: z.custom<typeof expenses.$inferSelect>(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/expenses/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },
  accounts: {
    list: {
      method: 'GET' as const,
      path: '/api/accounts',
      responses: {
        200: z.array(z.custom<typeof accounts.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/accounts',
      input: insertAccountSchema,
      responses: {
        201: z.custom<typeof accounts.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
  },
  snapshots: {
    list: {
      method: 'GET' as const,
      path: '/api/snapshots',
      responses: {
        200: z.array(z.custom<typeof accountSnapshots.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/snapshots',
      input: insertAccountSnapshotSchema,
      responses: {
        201: z.custom<typeof accountSnapshots.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
  },
  imports: {
    upload: {
      method: 'POST' as const,
      path: '/api/import',
      // No input schema for file upload (handled via multer/busboy manually usually or assumed separate)
      // We can use a simplified schema for metadata if needed
      responses: {
        200: z.object({ message: z.string(), imported: z.object({ reservations: z.number(), apartments: z.number() }) }),
        400: errorSchemas.validation,
      }
    }
  },
  employees: {
    list: {
      method: 'GET' as const,
      path: '/api/employees',
      responses: {
        200: z.array(z.custom<typeof employees.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/employees/:id',
      responses: {
        200: z.custom<typeof employees.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/employees',
      input: insertEmployeeSchema,
      responses: {
        201: z.custom<typeof employees.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/employees/:id',
      input: insertEmployeeSchema.partial(),
      responses: {
        200: z.custom<typeof employees.$inferSelect>(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/employees/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },
  medicalExams: {
    list: {
      method: 'GET' as const,
      path: '/api/employees/:employeeId/medical-exams',
      responses: {
        200: z.array(z.custom<typeof medicalExams.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/employees/:employeeId/medical-exams',
      input: insertMedicalExamSchema,
      responses: {
        201: z.custom<typeof medicalExams.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/medical-exams/:id',
      responses: {
        204: z.void(),
      },
    },
  },
  ownerPayments: {
    list: {
      method: 'GET' as const,
      path: '/api/apartments/:apartmentId/payments',
      responses: {
        200: z.array(z.custom<typeof ownerPayments.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/apartments/:apartmentId/payments',
      input: insertOwnerPaymentSchema,
      responses: {
        201: z.custom<typeof ownerPayments.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/owner-payments/:id',
      responses: {
        204: z.void(),
      },
    },
  },
  blockades: {
    list: {
      method: 'GET' as const,
      path: '/api/blockades',
      responses: {
        200: z.array(z.custom<typeof blockades.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/blockades',
      input: insertBlockadeSchema,
      responses: {
        201: z.custom<typeof blockades.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/blockades/:id',
      responses: {
        204: z.void(),
      },
    },
  },
  stats: {
    dashboard: {
      method: 'GET' as const,
      path: '/api/stats/dashboard',
      responses: {
        200: z.object({
          totalRevenue: z.number(),
          totalExpenses: z.number(),
          netIncome: z.number(),
          occupancyRate: z.number(),
        }),
      }
    }
  }
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
