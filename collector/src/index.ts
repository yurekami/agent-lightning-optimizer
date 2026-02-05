import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { ZodError } from 'zod';
import { authMiddleware } from './middleware/auth';
import { trajectoryService } from './services/trajectory';
import {
  TrajectoryInputSchema,
  TrajectoryFiltersSchema,
  StreamStepInputSchema,
  CompleteTrajectoryInputSchema,
} from './schemas';

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);
const NODE_ENV = process.env.NODE_ENV || 'development';

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'agent-lightning-collector',
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
  });
});

app.post('/trajectories', authMiddleware, async (req: Request, res: Response) => {
  try {
    const data = TrajectoryInputSchema.parse(req.body);
    const trajectory = await trajectoryService.createTrajectory(data);

    res.status(201).json({
      success: true,
      data: trajectory,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors,
      });
      return;
    }

    console.error('Error creating trajectory:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to create trajectory',
    });
  }
});

app.post('/trajectories/start', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { agent_id, task_type, initial_prompt, metadata } = req.body;

    if (!agent_id || !task_type || !initial_prompt) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'agent_id, task_type, and initial_prompt are required',
      });
      return;
    }

    const trajectory = await trajectoryService.startTrajectory({
      agent_id,
      task_type,
      initial_prompt,
      metadata,
    });

    res.status(201).json({
      success: true,
      data: trajectory,
    });
  } catch (error) {
    console.error('Error starting trajectory:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to start trajectory',
    });
  }
});

app.post('/trajectories/stream', authMiddleware, async (req: Request, res: Response) => {
  try {
    const data = StreamStepInputSchema.parse(req.body);
    await trajectoryService.appendStep(data.trajectory_id, data.step);

    res.status(200).json({
      success: true,
      message: 'Step added successfully',
    });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors,
      });
      return;
    }

    if (error instanceof Error && error.message === 'Trajectory not found') {
      res.status(404).json({
        success: false,
        error: 'Not found',
        message: 'Trajectory not found',
      });
      return;
    }

    console.error('Error appending step:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to append step',
    });
  }
});

app.post(
  '/trajectories/:id/complete',
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const data = CompleteTrajectoryInputSchema.parse(req.body);

      const trajectory = await trajectoryService.completeTrajectory(id, data);

      res.status(200).json({
        success: true,
        data: trajectory,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors,
        });
        return;
      }

      if (error instanceof Error && error.message === 'Trajectory not found') {
        res.status(404).json({
          success: false,
          error: 'Not found',
          message: 'Trajectory not found',
        });
        return;
      }

      console.error('Error completing trajectory:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to complete trajectory',
      });
    }
  }
);

app.get('/trajectories/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const trajectory = await trajectoryService.getTrajectory(id);

    if (!trajectory) {
      res.status(404).json({
        success: false,
        error: 'Not found',
        message: 'Trajectory not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: trajectory,
    });
  } catch (error) {
    console.error('Error fetching trajectory:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to fetch trajectory',
    });
  }
});

app.get('/trajectories', authMiddleware, async (req: Request, res: Response) => {
  try {
    const filters = TrajectoryFiltersSchema.parse(req.query);
    const trajectories = await trajectoryService.listTrajectories(filters);

    res.status(200).json({
      success: true,
      data: trajectories,
      pagination: {
        limit: filters.limit,
        offset: filters.offset,
        count: trajectories.length,
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors,
      });
      return;
    }

    console.error('Error listing trajectories:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to list trajectories',
    });
  }
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: NODE_ENV === 'development' ? err.message : 'An unexpected error occurred',
  });
});

app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Not found',
    message: 'Endpoint not found',
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Agent Lightning Collector running on port ${PORT}`);
  console.log(`Environment: ${NODE_ENV}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

export default app;
