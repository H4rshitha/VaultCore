import { CustomerRepository } from '../repositories/customerRepository.js';
import { ForbiddenError, NotFoundError, ApiResponse } from '@vaultcore/shared';

const customerRepository = new CustomerRepository();

export class CustomerController {
  static async searchCustomers(req, res, next) {
    try {
      if (req.user.role !== 'TELLER' && req.user.role !== 'ADMIN') {
        throw new ForbiddenError(
          'Access denied: Customer search is restricted to Tellers and Administrators'
        );
      }

      const { customerId, email, phone, name, query } = req.query;
      const customers = await customerRepository.searchCustomers({
        customerId,
        email,
        phone,
        name: name || query,
        query,
      });

      return ApiResponse.success(res, 'Customers retrieved successfully', customers);
    } catch (error) {
      next(error);
    }
  }

  static async getCustomerById(req, res, next) {
    try {
      if (req.user.role !== 'TELLER' && req.user.role !== 'ADMIN') {
        throw new ForbiddenError(
          'Access denied: Customer details are restricted to Tellers and Administrators'
        );
      }

      const { customerId } = req.params;
      const customer = await customerRepository.findById(customerId);
      if (!customer) {
        throw new NotFoundError(`Customer with ID ${customerId} not found`);
      }

      const mapped = {
        customerId: customer.id,
        id: customer.id,
        fullName: `${customer.firstName} ${customer.lastName}`.trim(),
        firstName: customer.firstName,
        lastName: customer.lastName,
        email: customer.email,
        phone: '+1 (555) 019-2834',
        status: customer.isActive ? 'ACTIVE' : 'INACTIVE',
        role: customer.role,
        existingAccountCount: customer._count?.accounts ?? customer.accounts?.length ?? 0,
        accounts: customer.accounts || [],
      };

      return ApiResponse.success(res, 'Customer details retrieved', mapped);
    } catch (error) {
      next(error);
    }
  }
}
