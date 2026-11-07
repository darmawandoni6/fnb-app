package config

const (
	EnvDevelopment = "development"
	EnvProduction  = "production"
)

func (c *Config) IsDevelopment() bool {
	return c.Environment == EnvDevelopment
}
