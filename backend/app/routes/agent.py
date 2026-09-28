import logging

from fastapi import APIRouter, Depends

from ..schemas.models import AgentRequest, AgentResponse, FailAction
from ..security.auth import verify_token
from ..security.rate_limit import check_rate_limit
from ..security.size_limit import check_request_size
from ..llm_adapters.factory import create_adapter

logger = logging.getLogger("veilagent.agent")

router = APIRouter()

_adapter = None


def _get_adapter():
    global _adapter
    if _adapter is None:
        _adapter = create_adapter()
    return _adapter


@router.post("/agent/step", response_model=AgentResponse)
async def agent_step(
    request: AgentRequest,
    _token: str = Depends(verify_token),
    _rate: None = Depends(check_rate_limit),
    _size: None = Depends(check_request_size),
) -> AgentResponse:
    logger.info(
        "agent_step: step=%d/%d, task_length=%d, elements=%d",
        request.step,
        request.max_steps,
        len(request.task),
        len(request.context.elements),
    )

    if request.step >= request.max_steps:
        return AgentResponse(
            action=FailAction(reason="Maximum steps reached"),
            thought="Step limit exceeded.",
        )

    adapter = _get_adapter()
    response = await adapter.get_action(request)

    logger.info(
        "agent_step: responded with action_type=%s",
        response.action.type,
    )

    return response
