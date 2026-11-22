package com.example.notifyhub.api;

import com.example.notifyhub.config.SecurityConfig;
import com.example.notifyhub.model.ServiceStatus;
import com.example.notifyhub.service.ChannelService;
import com.example.notifyhub.service.DashboardService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.httpBasic;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(DashboardController.class)
@Import(SecurityConfig.class)
class DashboardControllerSecurityTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private ChannelService channelService;

    @MockitoBean
    private DashboardService dashboardService;

    @ParameterizedTest
    @ValueSource(strings = {"enable", "disable"})
    void toggle_withoutCredentials_isUnauthorized(String action) throws Exception {
        mockMvc.perform(post("/api/dashboard/services/email/" + action))
                .andExpect(status().isUnauthorized());
        verifyNoInteractions(channelService);
    }

    @ParameterizedTest
    @ValueSource(strings = {"enable", "disable"})
    void toggle_asUser_isForbidden(String action) throws Exception {
        mockMvc.perform(post("/api/dashboard/services/email/" + action)
                        .with(user("viewer").roles("USER")))
                .andExpect(status().isForbidden());
        verifyNoInteractions(channelService);
    }

    @ParameterizedTest
    @ValueSource(strings = {"enable", "disable"})
    void toggle_asAdmin_updatesState(String action) throws Exception {
        boolean enabled = action.equals("enable");
        given(channelService.setEnabled("email", enabled))
                .willReturn(new ServiceStatus("email", enabled));

        mockMvc.perform(post("/api/dashboard/services/email/" + action)
                        .with(httpBasic("admin", "admin")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.channel").value("email"))
                .andExpect(jsonPath("$.enabled").value(enabled));
        verify(channelService).setEnabled("email", enabled);
    }

    @Test
    void explicitState_withoutCredentials_isUnauthorized() throws Exception {
        mockMvc.perform(put("/api/dashboard/services/email")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"enabled\":false}"))
                .andExpect(status().isUnauthorized());
        verifyNoInteractions(channelService);
    }

    @Test
    void explicitState_asUser_isForbidden() throws Exception {
        mockMvc.perform(put("/api/dashboard/services/email")
                        .with(user("viewer").roles("USER"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"enabled\":false}"))
                .andExpect(status().isForbidden());
        verifyNoInteractions(channelService);
    }

    @Test
    void explicitState_asAdmin_updatesState() throws Exception {
        given(channelService.setEnabled("email", false))
                .willReturn(new ServiceStatus("email", false));
        mockMvc.perform(put("/api/dashboard/services/email")
                        .with(httpBasic("admin", "admin"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"enabled\":false}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.enabled").value(false));
        verify(channelService).setEnabled("email", false);
    }

    @Test
    void registration_withoutCredentials_isUnauthorized() throws Exception {
        mockMvc.perform(post("/api/dashboard/services")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"channel\":\"webhook\"}"))
                .andExpect(status().isUnauthorized());
        verifyNoInteractions(channelService);
    }

    @Test
    void registration_asUser_isForbidden() throws Exception {
        mockMvc.perform(post("/api/dashboard/services")
                        .with(user("viewer").roles("USER"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"channel\":\"webhook\"}"))
                .andExpect(status().isForbidden());
        verifyNoInteractions(channelService);
    }

    @Test
    void registration_asAdmin_createsChannel() throws Exception {
        given(channelService.registerChannel("webhook"))
                .willReturn(new ServiceStatus("webhook", true));
        mockMvc.perform(post("/api/dashboard/services")
                        .with(httpBasic("admin", "admin"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"channel\":\"webhook\"}"))
                .andExpect(status().isCreated());
        verify(channelService).registerChannel("webhook");
    }

    @Test
    void dashboardReads_remainPublic() throws Exception {
        given(channelService.getServices()).willReturn(List.of(new ServiceStatus("email", true)));
        mockMvc.perform(get("/api/dashboard/services"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].channel").value("email"));
    }
}
