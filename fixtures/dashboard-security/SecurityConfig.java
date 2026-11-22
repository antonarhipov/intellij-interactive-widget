package com.example.notifyhub.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;
import org.springframework.security.web.SecurityFilterChain;

/**
 * Web security configuration for NotifyHub.
 *
 * <p>The notification-sending API exposed by
 * {@link com.example.notifyhub.api.NotificationController} performs privileged
 * operations and is therefore restricted to the {@code ADMIN} role. Dashboard
 * channel mutations also require ADMIN, including the explicit-state PUT route.
 * Dashboard reads and static assets remain accessible without a login.
 *
 * <p>Authentication uses HTTP Basic against a single in-memory administrator
 * account whose credentials are configurable via {@code notifyhub.security.admin.*}.
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final String adminUsername;
    private final String adminPassword;

    public SecurityConfig(
            @Value("${notifyhub.security.admin.username:admin}") String adminUsername,
            @Value("${notifyhub.security.admin.password:admin}") String adminPassword) {
        this.adminUsername = adminUsername;
        this.adminPassword = adminPassword;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                // Stateless REST clients authenticate on every call, so CSRF tokens do not apply.
                .csrf(csrf -> csrf.disable())
                .authorizeHttpRequests(auth -> auth
                        // Restrict notification operations and channel controls to administrators.
                        .requestMatchers("/api/notify/**", "/api/health", "/api/channels").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.POST,
                                "/api/dashboard/services",
                                "/api/dashboard/services/*/enable",
                                "/api/dashboard/services/*/disable").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PUT,
                                "/api/dashboard/services/*").hasRole("ADMIN")
                        .anyRequest().permitAll())
                .httpBasic(Customizer.withDefaults());
        return http.build();
    }

    @Bean
    public UserDetailsService userDetailsService(PasswordEncoder passwordEncoder) {
        UserDetails admin = User.withUsername(adminUsername)
                .password(passwordEncoder.encode(adminPassword))
                .roles("ADMIN")
                .build();
        return new InMemoryUserDetailsManager(admin);
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
