from abc import ABC, abstractmethod

from ..schemas.models import AgentRequest, AgentResponse


class LLMAdapter(ABC):
    @abstractmethod
    async def get_action(self, request: AgentRequest) -> AgentResponse:
        ...
