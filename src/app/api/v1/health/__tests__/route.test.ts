import { NextResponse } from 'next/server';
import { GET } from '../route';
import { HealthService } from '@/services/healthService';

// Mock the HealthService for testing purposes
jest.mock('@/services/healthService');

/**
 * Test suite for the Health Check API endpoint.
 */
describe('Health Check API', () => {
  let mockHealthService: jest.Mocked<HealthService>;

  /**
   * Setup executed before each test case to ensure a clean state.
   */
  beforeEach(() => {
    jest.clearAllMocks();
    mockHealthService = {
      check: jest.fn(),
    } as unknown as jest.Mocked<HealthService>;
    (HealthService as jest.MockedClass<typeof HealthService>).mockImplementation(() => mockHealthService);
  });

  /**
   * Test case: Verify that a 200 status code is returned when all services are operational.
   */
  it('should return 200 status code when all services are healthy', async () => {
    // Arrange: Configure mock response for a healthy service state
    mockHealthService.check.mockResolvedValue({
      status: 'success',
      data: {
        overall: 'healthy',
        database: 'ok',
        cache: 'ok'
      },
      message: 'Service is operational',
      timestamp: '2024-01-01T00:00:00.000Z'
    });

    // Act: Invoke the GET endpoint
    const response = await GET();

    // Assert: Validate the response
    expect(response).toBeInstanceOf(NextResponse);
    expect(response.status).toBe(200);

    const responseData = await response.json();
    expect(responseData).toEqual({
      status: 'success',
      data: {
        overall: 'healthy',
        database: 'ok',
        cache: 'ok'
      },
      message: 'Service is operational',
      timestamp: expect.any(String)
    });
  });

  /**
   * Test case: Verify that a 503 status code is returned when a service is unhealthy.
   */
  it('should return 503 status code when a service is unhealthy', async () => {
    // Arrange: Configure mock response for an unhealthy service state
    mockHealthService.check.mockResolvedValue({
      status: 'error',
      data: {
        component: 'database',
        reason: 'Connection failed'
      },
      message: 'Service unavailable',
      code: 'SERVICE_UNAVAILABLE',
      timestamp: '2024-01-01T00:00:00.000Z'
    });

    // Act: Invoke the GET endpoint
    const response = await GET();

    // Assert: Validate the response
    expect(response).toBeInstanceOf(NextResponse);
    expect(response.status).toBe(503);

    const responseData = await response.json();
    expect(responseData).toEqual({
      status: 'error',
      data: {
        component: 'database',
        reason: 'Connection failed'
      },
      message: 'Service unavailable',
      code: 'SERVICE_UNAVAILABLE',
      timestamp: expect.any(String)
    });
  });

  /**
   * Test case: Verify that a 503 status code is returned on internal server errors.
   */
  it('should return 503 status code on internal server error', async () => {
    // Arrange: Configure mock to simulate an internal server error
    mockHealthService.check.mockRejectedValue(new Error('Internal server error'));

    // Act: Invoke the GET endpoint
    const response = await GET();

    // Assert: Validate the response
    expect(response).toBeInstanceOf(NextResponse);
    expect(response.status).toBe(503);

    const responseData = await response.json();
    expect(responseData).toEqual({
      status: 'error',
      data: {
        component: 'server',
        reason: 'Internal error'
      },
      message: 'Service unavailable',
      code: 'SERVICE_UNAVAILABLE',
      timestamp: expect.any(String)
    });
  });
});